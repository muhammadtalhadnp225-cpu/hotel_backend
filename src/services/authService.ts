import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { ENV } from '../config/env.js';
import { StorageService } from './storageService.js';

export interface UserTokenPayload {
  id: string;
  role: string;
  email: string;
  name: string;
}

export class AuthService {
  /**
   * Generates a signed JWT token for an authenticated user
   */
  static generateToken(user: { _id?: any; id?: string; role: string; email: string; name?: string }): string {
    const userId = (user._id || user.id).toString();
    const payload: UserTokenPayload = {
      id: userId,
      role: user.role.toLowerCase(),
      email: user.email.toLowerCase(),
      name: user.name || '',
    };

    return jwt.sign(payload, ENV.JWT_SECRET, {
      expiresIn: ENV.JWT_EXPIRES_IN as any,
    });
  }

  /**
   * Verifies a JWT token and returns the decoded payload
   */
  static verifyToken(token: string): UserTokenPayload {
    return jwt.verify(token, ENV.JWT_SECRET) as UserTokenPayload;
  }

  /**
   * Hashes a plain-text password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  /**
   * Compares a candidate plain password with a stored hash
   */
  static async comparePassword(plain: string, hashed: string): Promise<boolean> {
    if (!plain || !hashed) return false;
    return bcrypt.compare(plain, hashed);
  }

  /**
   * Authenticates user credentials and returns user and token
   */
  static async login(email: string, plainPassword: string) {
    if (!email || !plainPassword) {
      throw { status: 400, message: 'Please provide both email and password' };
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await StorageService.findUserByEmail(normalizedEmail, true);

    if (!user) {
      throw { status: 401, message: 'Invalid credentials. User with this email does not exist.' };
    }

    if (user.status === 'inactive' || user.status === 'suspended') {
      throw {
        status: 403,
        message: 'Your account is deactivated or suspended. Please contact the administrator.',
      };
    }

    // Verify bcrypt hash
    const isPasswordValid = await this.comparePassword(plainPassword, user.password || '');
    if (!isPasswordValid) {
      throw { status: 401, message: 'Invalid credentials. Incorrect password.' };
    }

    // Update last login timestamp
    await StorageService.updateUser(user._id.toString(), { lastLogin: new Date() });

    // Generate JWT
    const token = this.generateToken(user);

    const safeUser = {
      _id: user._id.toString(),
      id: user._id.toString(),
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      title: user.title || 'Mr',
      nationality: user.nationality || user.address?.country || '',
      idType: user.idType || 'passport',
      idNumber: user.idNumber || '',
      address: user.address,
      stayPreferences: user.stayPreferences,
      membershipTier: user.membershipTier || 'Patron Circle',
      email: user.email,
      role: user.role.toLowerCase(),
      phone: user.phone || '',
      department: user.department || 'Front Desk',
      status: user.status || 'active',
      lastLogin: new Date(),
    };

    return {
      token,
      user: safeUser,
    };
  }

  /**
   * Retrieves current authenticated user profile
   */
  static async getCurrentUser(userId: string) {
    const user = await StorageService.findUserById(userId);
    if (!user) {
      throw { status: 404, message: 'User profile not found' };
    }

    if (user.status === 'inactive' || user.status === 'suspended') {
      throw { status: 403, message: 'User account is deactivated' };
    }

    return {
      _id: user._id.toString(),
      id: user._id.toString(),
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      title: user.title || 'Mr',
      nationality: user.nationality || user.address?.country || '',
      idType: user.idType || 'passport',
      idNumber: user.idNumber || '',
      address: user.address,
      stayPreferences: user.stayPreferences,
      membershipTier: user.membershipTier || 'Patron Circle',
      email: user.email,
      role: user.role.toLowerCase(),
      phone: user.phone || '',
      department: user.department || 'Front Desk',
      status: user.status || 'active',
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    };
  }

  /**
   * Registers a new staff member account (Admin only)
   */
  static async registerStaff(data: {
    name: string;
    email: string;
    password: string;
    role?: string;
    department?: string;
    phone?: string;
  }) {
    const { name, email, password, role, department, phone } = data;

    if (!name || !email || !password) {
      throw { status: 400, message: 'Name, email, and password are required' };
    }

    if (password.length < 6) {
      throw { status: 400, message: 'Password must be at least 6 characters long' };
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await StorageService.findUserByEmail(normalizedEmail);
    if (existing) {
      throw { status: 400, message: 'A user with this email address already exists' };
    }

    const normalizedRole = (role || 'receptionist').toLowerCase();

    const createdUser = await StorageService.createUser({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: normalizedRole,
      department: department || 'Front Desk',
      phone: phone || '',
      status: 'active',
    });

    return createdUser;
  }

  /**
   * Registers a new guest / customer / patron account from the website
   */
  static async registerPatron(data: {
    email: string;
    password: string;
    title?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    phone?: string;
    nationality?: string;
    idType?: string;
    idNumber?: string;
    address?: any;
    stayPreferences?: any;
  }) {
    const { email, password, title, firstName, lastName, phone, nationality, idType, idNumber, address, stayPreferences } = data;

    if (!email || !password) {
      throw { status: 400, message: 'Email and password are required' };
    }

    if (password.length < 6) {
      throw { status: 400, message: 'Password must be at least 6 characters long' };
    }

    const fullName = data.name || `${firstName || ''} ${lastName || ''}`.trim() || 'Valued Guest';
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await StorageService.findUserByEmail(normalizedEmail);
    if (existing) {
      throw { status: 400, message: 'An account with this email address already exists. Please log in.' };
    }

    const createdUser = await StorageService.createUser({
      name: fullName,
      firstName: firstName?.trim(),
      lastName: lastName?.trim(),
      title: title || 'Mr',
      email: normalizedEmail,
      password,
      role: 'guest',
      department: 'Patron Guest',
      phone: phone || '',
      nationality: nationality?.trim() || address?.country?.trim() || '',
      idType: idType || 'passport',
      idNumber: idNumber?.trim() || '',
      address: address || {},
      stayPreferences: stayPreferences || {},
      membershipTier: 'Patron Circle',
      status: 'active',
    });

    // Automatically synchronize patron account to Admin Panel Guests directory
    try {
      await StorageService.syncUserToGuest(createdUser);
    } catch (e: any) {
      console.warn('[Sync User to Guest Warning]:', e.message);
    }

    const token = this.generateToken(createdUser);

    const safeUser = {
      _id: (createdUser._id || createdUser.id).toString(),
      id: (createdUser._id || createdUser.id).toString(),
      name: createdUser.name,
      firstName: createdUser.firstName || firstName,
      lastName: createdUser.lastName || lastName,
      title: createdUser.title || title || 'Mr',
      nationality: createdUser.nationality || nationality || address?.country || '',
      idType: createdUser.idType || idType || 'passport',
      idNumber: createdUser.idNumber || idNumber || '',
      email: createdUser.email,
      role: 'guest',
      phone: createdUser.phone || '',
      department: 'Patron Guest',
      membershipTier: createdUser.membershipTier || 'Patron Circle',
      status: 'active',
      address: createdUser.address || address,
      stayPreferences: createdUser.stayPreferences || stayPreferences,
      createdAt: createdUser.createdAt || new Date(),
    };

    return {
      token,
      user: safeUser,
    };
  }
}

export default AuthService;
