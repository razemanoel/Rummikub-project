import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UserModel, VerificationCode, FailedResetAttempt } from '../models/User';
import { generateToken } from '../config/jwt';
import { sendVerificationCodeEmail } from '../services/emailService';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rate limiting constants
const MAX_ATTEMPTS_PER_EMAIL_PER_HOUR = 5;
const MAX_ATTEMPTS_PER_IP_PER_HOUR = 20;

// Helper function to get client IP address
function getClientIP(req: AuthRequest): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
         (req.headers['x-real-ip'] as string) ||
         req.ip ||
         req.connection?.remoteAddress ||
         'unknown';
}

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
      const clientIP = getClientIP(req);

      console.log(`\n📨 [FORGOT_PASSWORD] Request received from IP: ${clientIP}, Email: ${email}`);

      // Validate and normalize email
      const emailValidation = validateAndNormalizeEmail(email);
      if (!emailValidation.isValid) {
        console.warn(`⚠️  [FORGOT_PASSWORD] Invalid email format: ${email}`);
        return res.status(400).json({
          success: false,
          message: 'Invalid email format',
        });
      }

      const normalizedEmail = emailValidation.normalizedEmail;

      // Check rate limiting by email
      const emailAttempts = await FailedResetAttempt.getRecentAttempts(normalizedEmail, 60);
      if (emailAttempts >= MAX_ATTEMPTS_PER_EMAIL_PER_HOUR) {
        console.warn(`🚫 [SECURITY] Too many password reset attempts for email: ${normalizedEmail} from IP: ${clientIP}`);
        return res.status(429).json({
          success: false,
          message: 'Too many password reset attempts. Please try again later.',
        });
      }

      // Check rate limiting by IP
      const ipAttempts = await FailedResetAttempt.getAttemptsByIP(clientIP, 60);
      if (ipAttempts >= MAX_ATTEMPTS_PER_IP_PER_HOUR) {
        console.warn(`🚫 [SECURITY] Too many password reset attempts from IP: ${clientIP}`);
        return res.status(429).json({
          success: false,
          message: 'Too many password reset attempts. Please try again later.',
        });
      }

      // Check if user exists
      const user = await UserModel.findByEmail(normalizedEmail);
      if (!user) {
        // Record failed attempt (email doesn't exist)
        await FailedResetAttempt.record(normalizedEmail, clientIP);
        console.warn(`⚠️  [SECURITY] Password reset attempt with non-existent email: ${normalizedEmail} from IP: ${clientIP}`);
        
        // Don't reveal if email exists or not (security best practice)
        return res.status(200).json({
          success: true,
          message: 'If email exists, reset code will be sent',
        });
      }

      console.log(`✅ [FORGOT_PASSWORD] User found for email: ${normalizedEmail}`);

      // Generate verification code
      const code = await VerificationCode.create(normalizedEmail);
      console.log(`🔐 [FORGOT_PASSWORD] Verification code generated: ${code}`);

      // Send email with code
      const emailSent = await sendVerificationCodeEmail(normalizedEmail, code);

      if (!emailSent) {
        console.error(`❌ [FORGOT_PASSWORD] Failed to send email to: ${normalizedEmail}`);
        return res.status(500).json({
          success: false,
          message: 'Failed to send verification email',
        });
      }

      console.log(`📧 [FORGOT_PASSWORD] Success - Code sent to: ${normalizedEmail}`);
      return res.status(200).json({
        success: true,
        message: 'Verification code sent to your email',
      });
    } catch (error) {
      console.error('❌ [FORGOT_PASSWORD] Error:', error);
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

  static async verifyCode(req: AuthRequest, res: Response) {
    try {
      const { email, code } = req.body;

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
      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Verification code is required',
        });
      }

      // Check if code is valid (don't consume it yet)
      const isValid = await VerificationCode.check(normalizedEmail, code);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired verification code',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Verification code is valid',
      });
    } catch (error) {
      console.error('Verify code error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify code',
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
