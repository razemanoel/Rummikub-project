import { Request, Response } from 'express';
import axios from 'axios';

const VISION_SOLVER_URL =
  process.env.VISION_SOLVER_URL || 'http://127.0.0.1:8000';

export class SolverController {
  static async solve(req: Request, res: Response) {
    try {
      const gameState = req.body;

      const response = await axios.post(
        `${VISION_SOLVER_URL}/solve-ilp`,
        gameState
      );

      return res.status(200).json({
        success: true,
        message: 'Solution calculated successfully',
        data: response.data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to calculate solution',
      });
    }
  }

  static async validate(req: Request, res: Response) {
    try {
      const gameState = req.body;

      const response = await axios.post(
        `${VISION_SOLVER_URL}/validate-game-state`,
        gameState
      );

      return res.status(200).json({
        success: true,
        message: 'Game state validated successfully',
        data: response.data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to validate game state',
      });
    }
  }
}