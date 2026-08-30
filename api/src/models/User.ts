import { getDatabase } from '../config/database';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

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

  private static formatUser(user: User | null): User {
    if (!user) return null as any;
    return {
      ...user,
      id: user._id?.toString(),
    };
  }
}