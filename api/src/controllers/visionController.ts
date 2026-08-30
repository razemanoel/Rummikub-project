import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ImageNormalizationError } from '../services/imageNormalizationService';
import { visionService } from '../services/visionService';
import { visionFeedbackService } from '../services/visionFeedbackService';

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

      // Forward to vision service
      const result = await visionService.analyzeBoards(myBoardFile, sharedBoardFile);

      // Return appropriate status code
      const statusCode = result.success ? 200 : 400;
      return res.status(statusCode).json(result);
    } catch (error: any) {
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

  static async submitFeedback(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized - valid token required',
        });
      }

      const files = req.files as { [key: string]: any[] } | undefined;
      const rackImageFile = files?.rackImage?.[0];
      const boardImageFile = files?.boardImage?.[0];

      const result = await visionFeedbackService.saveFeedback(
        req.body.feedback,
        rackImageFile,
        boardImageFile
      );

      return res.status(201).json({
        success: true,
        message: 'Vision feedback saved successfully',
        data: result,
      });
    } catch (error: any) {
      const message = error.message || 'Failed to save vision feedback';
      const statusCode =
        error instanceof ImageNormalizationError
        || message.includes('Feedback payload')
        || message.includes('corrections')
          ? 400
          : 500;

      return res.status(statusCode).json({
        success: false,
        message,
      });
    }
  }
}
