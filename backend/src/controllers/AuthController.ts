import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UserModel, VerificationCode } from '../models/User';
import { generateToken } from '../config/jwt';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Helper function to validate and normalize email
function validateAndNormalizeEmail(email: string): { isValid: true; normalizedEmail: string } | { isValid: false } {
  if (!email || typeof email !== 'string') {
    return { isValid: false };
  }
  
  const normalizedEmail = email.trim().toLowerCase();
  const isValid = EMAIL_REGEX.test(normalizedEmail);
  
  if (isValid) {
    return { isValid: true, normalizedEmail };
  }
  
  return { isValid: false };
}

export class AuthController {
  static async signup(req: AuthRequest, res: Response) {
    try {
      const { email, password, confirmPassword } = req.body;

      // Validate and normalize email
      const emailValidation = validateAndNormalizeEmail(email);
      if (!emailValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format',
        });
      }

      const normalizedEmail = emailValidation.normalizedEmail;
      // Validation
      if (!password || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Email, password, and confirm password are required',
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Passwords do not match',
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters',
        });
      }

      // Check if user exists
      const existingUser = await UserModel.findByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered',
        });
      }

      // Create user
      const user = await UserModel.create(normalizedEmail, password);

      // Generate token
      const token = generateToken({ userId: user.id!, email: user.email });

      return res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
          },
        },
      });
    } catch (error) {
      console.error('Signup error:', error);
      return res.status(500).json({
        success: false,
        message: 'Signup failed',
      });
    }
  }

  static async login(req: AuthRequest, res: Response) {
    try {
      const { email, password } = req.body;

      // Validate and normalize email
      const emailValidation = validateAndNormalizeEmail(email);
      if (!emailValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format',
        });
      }

      const normalizedEmail = emailValidation.normalizedEmail;
      // Validation
      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required',
        });
      }

      // Find user
      const user = await UserModel.findByEmail(normalizedEmail);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // Verify password
      const isPasswordValid = await UserModel.verifyPassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // Generate token
      const token = generateToken({ userId: user.id!, email: user.email });

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
          },
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        success: false,
        message: 'Login failed',
      });
    }
  }

  static async forgotPassword(req: AuthRequest, res: Response) {
    try {
      const { email } = req.body;

      // Validate and normalize email
      const emailValidation = validateAndNormalizeEmail(email);
      if (!emailValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format',
        });
      }

      const normalizedEmail = emailValidation.normalizedEmail;
      // Check if user exists
      const user = await UserModel.findByEmail(normalizedEmail);
      if (!user) {
        // Don't reveal if email exists or not (security best practice)
        return res.status(200).json({
          success: true,
          message: 'If email exists, reset code will be sent',
        });
      }

      // Generate verification code
      const code = await VerificationCode.create(normalizedEmail);

      // TODO: Send email with code
      console.log(`Reset code for ${normalizedEmail}: ${code}`);

      return res.status(200).json({
        success: true,
        message: 'Reset code sent to your email',
        // For development only - remove in production
        data: { code },
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to process forgot password request',
      });
    }
  }

  static async resetPassword(req: AuthRequest, res: Response) {
    try {
      const { email, code, newPassword, confirmPassword } = req.body;

      // Validate and normalize email
      const emailValidation = validateAndNormalizeEmail(email);
      if (!emailValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format',
        });
      }

      const normalizedEmail = emailValidation.normalizedEmail;

      // Validation
      if (!code || !newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Email, code, and password are required',
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Passwords do not match',
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters',
        });
      }

      // Verify code and consume it
      const isValid = await VerificationCode.consume(normalizedEmail, code);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired verification code',
        });
      }

      // Find user
      const user = await UserModel.findByEmail(normalizedEmail);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Update password
      await UserModel.updatePassword(user.id!, newPassword);

      return res.status(200).json({
        success: true,
        message: 'Password reset successfully',
      });
    } catch (error) {
      console.error('Reset password error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to reset password',
      });
    }
  }

  static async getProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const user = await UserModel.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          username: user.username,
        },
      });
    } catch (error) {
      console.error('Get profile error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get profile',
      });
    }
  }
}
