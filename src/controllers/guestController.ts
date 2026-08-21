import { Request, Response, NextFunction } from 'express';
import { StorageService } from '../services/storageService.js';
import { AuthService } from '../services/authService.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const getGuests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search } = req.query;
    const guests = await StorageService.getAllGuests(typeof search === 'string' ? search : undefined);

    res.status(200).json({
      success: true,
      count: guests.length,
      guests,
    });
  } catch (error) {
    next(error);
  }
};

export const getGuestById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const guest = await StorageService.getGuestById(id);

    if (!guest) {
      res.status(404).json({
        success: false,
        message: 'Guest not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      guest,
    });
  } catch (error) {
    next(error);
  }
};

export const createGuest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      fullName,
      email,
      password,
      phone,
      alternatePhone,
      emergencyContact,
      idType,
      idNumber,
      idIssuingCountry,
      idExpiryDate,
      nationality,
      dateOfBirth,
      gender,
      address,
      addressDetails,
      vipStatus,
      preferences,
      notes,
    } = req.body;

    if (!fullName || !phone) {
      res.status(400).json({
        success: false,
        message: 'Full name and phone number are required.',
      });
      return;
    }

    const guest = await StorageService.createGuest({
      fullName: fullName.trim(),
      email: email ? email.trim() : '',
      phone: phone.trim(),
      alternatePhone: alternatePhone ? alternatePhone.trim() : '',
      emergencyContact: emergencyContact || { name: '', phone: '', relationship: '' },
      idType: idType || 'passport',
      idNumber: idNumber ? idNumber.trim() : '',
      idIssuingCountry: idIssuingCountry ? idIssuingCountry.trim() : '',
      idExpiryDate: idExpiryDate || undefined,
      nationality: nationality ? nationality.trim() : 'International',
      dateOfBirth: dateOfBirth || undefined,
      gender: gender || '',
      address: address ? address.trim() : '',
      addressDetails: addressDetails || { street: '', city: '', state: '', zipCode: '', country: '' },
      vipStatus: Boolean(vipStatus),
      preferences: Array.isArray(preferences) ? preferences : [],
      notes: notes ? notes.trim() : '',
    });

    // Create or update Portal User account if email and password are provided
    if (email && email.trim() && password && password.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      try {
        const existingUser = await StorageService.findUserByEmail(normalizedEmail, true);
        if (existingUser) {
          await StorageService.updateUser(existingUser._id.toString(), {
            password: password.trim(),
            name: fullName.trim(),
            phone: phone.trim(),
            nationality: nationality ? nationality.trim() : 'International',
            idType: idType || 'passport',
            idNumber: idNumber ? idNumber.trim() : '',
          });
        } else {
          await StorageService.createUser({
            name: fullName.trim(),
            email: normalizedEmail,
            password: password.trim(),
            role: 'guest',
            department: 'Front Desk',
            phone: phone.trim(),
            nationality: nationality ? nationality.trim() : 'International',
            idType: idType || 'passport',
            idNumber: idNumber ? idNumber.trim() : '',
            status: 'active',
          });
        }
      } catch (authErr) {
        console.error('Error creating guest portal user account:', authErr);
      }
    }

    await StorageService.logAction({
      userName: req.user?.name || 'Staff',
      userRole: req.user?.role || 'receptionist',
      module: 'reception',
      action: 'GUEST_CREATED',
      details: `Created new guest profile for ${guest.fullName} (${guest.phone}) with ID ${guest.idType}: ${guest.idNumber || 'N/A'}.`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Guest profile created successfully',
      guest,
    });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }
    next(error);
  }
};

export const updateGuest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existing = await StorageService.getGuestById(id);
    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Guest profile not found',
      });
      return;
    }

    const updated = await StorageService.updateGuest(id, updateData);

    // Sync portal login account if password was updated
    const targetEmail = updateData.email || existing.email;
    if (targetEmail && targetEmail.trim() && updateData.password && updateData.password.trim()) {
      const normalizedEmail = targetEmail.trim().toLowerCase();
      try {
        const existingUser = await StorageService.findUserByEmail(normalizedEmail, true);
        if (existingUser) {
          await StorageService.updateUser(existingUser._id.toString(), {
            password: updateData.password.trim(),
            name: (updateData.fullName || existing.fullName).trim(),
            phone: (updateData.phone || existing.phone).trim(),
          });
        } else {
          await StorageService.createUser({
            name: (updateData.fullName || existing.fullName).trim(),
            email: normalizedEmail,
            password: updateData.password.trim(),
            role: 'guest',
            department: 'Front Desk',
            phone: (updateData.phone || existing.phone).trim(),
            status: 'active',
          });
        }
      } catch (authErr) {
        console.error('Error syncing guest portal user account:', authErr);
      }
    }

    await StorageService.logAction({
      userName: req.user?.name || 'Staff',
      userRole: req.user?.role || 'receptionist',
      module: 'reception',
      action: 'GUEST_UPDATED',
      details: `Updated guest profile for ${updated.fullName} (${updated.phone}).`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Guest profile updated successfully',
      guest: updated,
    });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }
    next(error);
  }
};

export const deleteGuest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const guest = await StorageService.getGuestById(id);
    if (!guest) {
      res.status(404).json({
        success: false,
        message: 'Guest profile not found',
      });
      return;
    }

    await StorageService.deleteGuest(id);

    await StorageService.logAction({
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'admin',
      module: 'admin',
      action: 'GUEST_DELETED',
      details: `Deleted guest profile for ${guest.fullName} (${guest.phone}).`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Guest profile deleted successfully',
    });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }
    next(error);
  }
};

export const getGuestHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const history = await StorageService.getGuestHistory(id);

    if (!history) {
      res.status(404).json({
        success: false,
        message: 'Guest history not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      history,
    });
  } catch (error) {
    next(error);
  }
};
