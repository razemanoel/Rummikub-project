import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { visionService } from '../services/visionService';
import { solveBestMove } from '../services/moveSolverService';
import { detectionsToRack } from '../utils/rummikubConverters';
import { GameState } from '../types/rummikub';

/**
 * VisionController handles all vision-related requests from the mobile app.
 * It validates authentication, receives uploaded images, forwards them to
 * the Python Vision service, and returns the analysis results.
 */
export class VisionController {
  /**
   * POST /api/vision/analyze
   * Analyzes uploaded board images and returns tile detection results
   * 
   * Request: multipart/form-data with fields:
   *   - myBoard: image file (optional)
   *   - sharedBoard: image file (optional)
   * 
   * Response: { success, message, data { myBoardDetections, sharedBoardDetections } }
   */
  static async analyzeBoards(req: AuthRequest, res: Response) {
    try {
      // Verify user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized - valid token required',
        });
      }

      console.log(`User ${req.user.email} requesting board analysis`);

      // Get uploaded files from multer middleware
      const files = req.files as { [key: string]: any[] } | undefined;

      const myBoardFile = files?.myBoard?.[0];
      const sharedBoardFile = files?.sharedBoard?.[0];

      // Validate at least one image is provided
      if (!myBoardFile && !sharedBoardFile) {
        return res.status(400).json({
          success: false,
          message: 'At least one board image is required',
        });
      }

      // Log file info for debugging
      if (myBoardFile) {
        console.log(`Processing myBoard: ${myBoardFile.originalname} (${myBoardFile.size} bytes)`);
      }
      if (sharedBoardFile) {
        console.log(`Processing sharedBoard: ${sharedBoardFile.originalname} (${sharedBoardFile.size} bytes)`);
      }

      // Forward to vision service
      const result = await visionService.analyzeBoards(myBoardFile, sharedBoardFile);

      // ── Move Solver ──────────────────────────────────────────────────────
      // Convert detected tiles to game state and run the move solver.
      //
      // v1 assumptions:
      //   - myBoardDetections → player's rack
      //   - sharedBoardDetections are available but NOT yet grouped into
      //     TileSets, so board is left empty for now.
      //
      // TODO: Once the vision service can group shared-board tiles into
      //       discrete sets, pass them as board: TileSet[] here and the
      //       extension-move logic in moveSolverService will activate.
      let suggestedMove = undefined;
      if (result.success) {
        const rack = detectionsToRack(result.data.myBoardDetections);
        const gameState: GameState = {
          rack,
          board: [], // TODO: populate from grouped sharedBoardDetections
        };
        suggestedMove = solveBestMove(gameState);
        console.log(
          `Move solver result for ${req.user!.email}: ${suggestedMove.explanation}`
        );
      }

      // Return appropriate status code
      const statusCode = result.success ? 200 : 400;
      return res.status(statusCode).json({
        ...result,
        data: {
          ...result.data,
          suggestedMove,
        },
      });
    } catch (error: any) {
      console.error('Vision analysis error:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to analyze boards: ' + error.message,
      });
    }
  }

  /**
   * GET /api/vision/health
   * Check if vision service is available
   */
  static async healthCheck(req: AuthRequest, res: Response) {
    try {
      const isHealthy = await visionService.healthCheck();
      return res.status(isHealthy ? 200 : 503).json({
        success: isHealthy,
        message: isHealthy ? 'Vision service is available' : 'Vision service is unavailable',
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to check vision service health',
      });
    }
  }
}
