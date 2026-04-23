import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../config/jwt';

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  req.user = payload;
  next();
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error(err);
  return res.status(500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
}