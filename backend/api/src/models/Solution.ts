import { ObjectId } from 'mongodb';

export interface SolutionRecord {
  _id?: ObjectId;
  userId: string;
  originalGameState: any;
  solution: any;
  tilesUsedCount: number;
  createdAt: Date;
}