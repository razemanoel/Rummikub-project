import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { visionService } from '../services/visionService';

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

      // Return appropriate status code
      const statusCode = result.success ? 200 : 400;
      return res.status(statusCode).json(result);
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
