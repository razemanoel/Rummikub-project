import jwt from 'jsonwebtoken';

export interface TokenPayload {
  userId: string;
  email: string;
}

const JWT_SECRET: string = process.env.JWT_SECRET || 'your_jwt_secret_key_change_this_in_production';
const JWT_EXPIRE: string = process.env.JWT_EXPIRE || '7d';

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE } as any);
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.decode(token) as TokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}
