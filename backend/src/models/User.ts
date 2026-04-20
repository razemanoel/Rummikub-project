import { getDatabase } from '../config/database';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface User {
  _id?: ObjectId;
  id?: string;
  email: string;
  password: string;
  username?: string;
  created_at?: Date;
  updated_at?: Date;
}

export class UserModel {
  static async create(email: string, password: string, username?: string): Promise<User> {
    const db = getDatabase();
    const usersCollection = db.collection<User>('users');
    const hashedPassword = await bcrypt.hash(password, 10);

    const now = new Date();
    const result = await usersCollection.insertOne({
      email,
      password: hashedPassword,
      ...(username && { username }),
      created_at: now,
      updated_at: now,
    });

    const createdUser = await usersCollection.findOne({ _id: result.insertedId });
    return this.formatUser(createdUser);
  }

  static async findByEmail(email: string): Promise<User | null> {
    const db = getDatabase();
    const usersCollection = db.collection<User>('users');
    const user = await usersCollection.findOne({ email });
    return user ? this.formatUser(user) : null;
  }

  static async findById(id: string | ObjectId): Promise<User | null> {
    const db = getDatabase();
    const usersCollection = db.collection<User>('users');
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const user = await usersCollection.findOne({ _id: objectId });
    return user ? this.formatUser(user) : null;
  }

  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  static async updatePassword(userId: string | ObjectId, newPassword: string): Promise<void> {
    const db = getDatabase();
    const usersCollection = db.collection<User>('users');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    await usersCollection.updateOne(
      { _id: objectId },
      { $set: { password: hashedPassword, updated_at: new Date() } }
    );
  }

  static async deleteById(id: string | ObjectId): Promise<void> {
    const db = getDatabase();
    const usersCollection = db.collection<User>('users');
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    await usersCollection.deleteOne({ _id: objectId });
  }

  private static formatUser(user: User | null): User {
    if (!user) return null as any;
    return {
      ...user,
      id: user._id?.toString(),
    };
  }
}

// Verification code functions
export class VerificationCode {
  static async create(email: string): Promise<string> {
    const db = getDatabase();
    const verificationCollection = db.collection('verification_codes');
    const code = generateRandomCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await verificationCollection.insertOne({
      email,
      code,
      expires_at: expiresAt,
      attempts: 0,
      created_at: new Date(),
    });

    return code;
  }

  static async check(email: string, code: string): Promise<boolean> {
    const db = getDatabase();
    const verificationCollection = db.collection('verification_codes');
    const record = await verificationCollection.findOne({
      email,
      code,
      expires_at: { $gt: new Date() },
    });

    return !!record;
  }

  static async consume(email: string, code: string): Promise<boolean> {
    const db = getDatabase();
    const verificationCollection = db.collection('verification_codes');
    const record = await verificationCollection.findOne({
      email,
      code,
      expires_at: { $gt: new Date() },
    });

    if (!record) {
      return false;
    }

    await verificationCollection.deleteOne({ _id: record._id });
    return true;
  }
}

function generateRandomCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}
