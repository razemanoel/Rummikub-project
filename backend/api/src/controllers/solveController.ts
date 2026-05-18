import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { solveBestMove } from '../services/moveSolverService';
import { validateGameState } from '../utils/validateGameState';

export class SolveController {
  /**
   * POST /api/solve
   *
   * Accepts a full GameState (rack + board) and returns the best move.
   *
   * TODO (future): support full board rearrangement / meld splitting.
   * TODO (future): enforce minimum opening move points rule (30 pts).
   */
  static solveGameState(req: AuthRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const validation = validateGameState(req.body);

    if ('error' in validation) {
      return res.status(400).json({ success: false, message: validation.error });
    }

    const { gameState } = validation;

    console.log(
      `Solve request from ${req.user.email}: ` +
        `${gameState.rack.length} rack tile(s), ${gameState.board.length} board set(s)`
    );

    const solverResult = solveBestMove(gameState);

    return res.status(200).json({
      success: true,
      data: { solverResult },
    });
  }
}
