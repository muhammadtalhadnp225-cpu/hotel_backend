import { Request, Response, NextFunction } from 'express';
import { StorageService } from '../services/storageService.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { EmailService } from '../services/emailService.js';
import { ENV } from '../config/env.js';


/**
 * Public endpoint: Submit new contact inquiry from the website
 */
export const submitContactInquiry = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, phone, subject, message, travelDates } = req.body;

    if (!name || !email || !message) {
      res.status(400).json({
        success: false,
        message: 'Name, email, and message are required fields.',
      });
      return;
    }

    const ticketId = `INQ-${Math.floor(100000 + Math.random() * 900000)}`;

    const savedInquiry = await StorageService.createContactInquiry({
      ticketId,
      name,
      email,
      phone: phone || '',
      subject: subject || 'General Sanctuary Inquiry',
      message,
      travelDates: travelDates || '',
      status: 'new',
      priority: 'normal',
      source: 'website',
      ipAddress: req.ip,
    });

    // Send instant confirmation email to guest
    EmailService.sendContactInquiryConfirmation(savedInquiry).catch((err) => {
      console.warn('[ContactController] Background confirmation email warning:', err.message);
    });

    // Audit log
    await StorageService.logAction({
      userName: name,
      userRole: 'guest',
      module: 'system',
      action: 'CONTACT_INQUIRY_SUBMITTED',
      details: `New contact inquiry received from ${email} (Ticket: ${ticketId}).`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for reaching out! Our Chief Concierge Desk will respond shortly.',
      ticketId,
      data: savedInquiry,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Admin endpoint: Get all contact inquiries with optional filtering
 */
export const getAllInquiries = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, search } = req.query;

    const inquiries = await StorageService.getAllContactInquiries({
      status: status ? String(status) : undefined,
      search: search ? String(search) : undefined,
    });

    res.status(200).json({
      success: true,
      count: inquiries.length,
      data: inquiries,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Admin endpoint: Get single inquiry by ID
 */
export const getInquiryById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const inquiry = await StorageService.getContactInquiryById(id);

    if (!inquiry) {
      res.status(404).json({
        success: false,
        message: 'Contact inquiry not found.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: inquiry,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Admin endpoint: Update inquiry status and staff notes
 */
export const updateInquiryStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, priority, staffNotes } = req.body;

    const updatePayload: any = {};
    if (status) updatePayload.status = status;
    if (priority) updatePayload.priority = priority;
    if (staffNotes !== undefined) updatePayload.staffNotes = staffNotes;

    const updated = await StorageService.updateContactInquiry(id, updatePayload);

    if (!updated) {
      res.status(404).json({
        success: false,
        message: 'Contact inquiry not found.',
      });
      return;
    }

    await StorageService.logAction({
      userName: req.user?.name || 'Administrator',
      userRole: req.user?.role || 'admin',
      module: 'system',
      action: 'CONTACT_INQUIRY_UPDATED',
      details: `Updated status of inquiry ${updated.ticketId} to [${updated.status}].`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Inquiry updated successfully.',
      data: updated,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Admin endpoint: Add staff reply to inquiry
 */
export const replyInquiry = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { responseMessage, staffNotes } = req.body;

    if (!responseMessage) {
      res.status(400).json({
        success: false,
        message: 'Response message is required.',
      });
      return;
    }

    const updatePayload: any = {
      responseMessage,
      status: 'responded',
      respondedAt: new Date(),
      respondedBy: req.user?.name || 'Concierge Desk',
    };
    if (staffNotes !== undefined) updatePayload.staffNotes = staffNotes;

    const updated = await StorageService.updateContactInquiry(id, updatePayload);

    if (!updated) {
      res.status(404).json({
        success: false,
        message: 'Contact inquiry not found.',
      });
      return;
    }

    // Dispatch official email response directly to guest's email address
    const responderName = req.user?.name || 'Chief Concierge';
    let emailResult: any = { success: false };
    try {
      emailResult = await EmailService.sendInquiryReplyToGuest(
        updated,
        responseMessage,
        responderName
      );
    } catch (mailErr: any) {
      console.error('[ContactController] Error sending reply email:', mailErr.message);
      emailResult = { success: false, error: mailErr.message };
    }

    await StorageService.logAction({
      userName: req.user?.name || 'Administrator',
      userRole: req.user?.role || 'admin',
      module: 'system',
      action: 'CONTACT_INQUIRY_REPLIED',
      details: `Replied to inquiry ${updated.ticketId} for guest ${updated.email}. Email dispatched: ${emailResult.success}.`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: emailResult.success
        ? `Inquiry response recorded and emailed to ${updated.email} from ${ENV.HOTEL_EMAIL}.`
        : `Inquiry response saved in system. (Email notification warning: ${emailResult.error || 'Check email address'})`,
      data: updated,
      emailDelivery: emailResult,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Admin endpoint: Delete inquiry
 */
export const deleteInquiry = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    await StorageService.deleteContactInquiry(id);

    await StorageService.logAction({
      userName: req.user?.name || 'Administrator',
      userRole: req.user?.role || 'admin',
      module: 'system',
      action: 'CONTACT_INQUIRY_DELETED',
      details: `Deleted contact inquiry record ${id}.`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Inquiry deleted successfully.',
    });
  } catch (error: any) {
    next(error);
  }
};
