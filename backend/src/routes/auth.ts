import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/signup', AuthController.signup);
router.post('/login', AuthController.login);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);

// Protected routes
router.get('/profile', authMiddleware, AuthController.getProfile);

export default router;
