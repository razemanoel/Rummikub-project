import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { getDatabase } from '../config/database';

export class SolutionHistoryController {
  static async saveSolution(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { originalGameState, solution } = req.body;

      const db = getDatabase();

      const record = {
        userId,
        originalGameState,
        solution,
        tilesUsedCount: solution?.tiles_used_count ?? 0,
        createdAt: new Date(),
      };

      const result = await db.collection('solutions').insertOne(record);

      return res.status(201).json({
        success: true,
        message: 'Solution saved successfully',
        data: {
          id: result.insertedId,
          ...record,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to save solution',
      });
    }
  }

  static async getMySolutions(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const db = getDatabase();

      const solutions = await db
        .collection('solutions')
        .find({ userId })
        .sort({ createdAt: -1 })
        .toArray();

      return res.status(200).json({
        success: true,
        message: 'Solutions loaded successfully',
        data: solutions,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to load solutions',
      });
    }
  }
}