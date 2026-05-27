import { Router } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { VisionController } from '../controllers/visionController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * Configure multer for handling file uploads
 * - Limits: 10MB per file, 20MB total
 * - Accepts JPEG and PNG images
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
  },
  fileFilter: (req: any, file: any, cb: FileFilterCallback): void => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images are allowed') as any, false);
    }
  },
});

/**
 * POST /api/vision/analyze
 * 
 * Analyzes Rummikub board images and returns detected tiles.
 * 
 * Authentication: Required (JWT token)
 * 
 * Request: multipart/form-data
 *   - myBoard: image file (optional)
 *   - sharedBoard: image file (optional)
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Boards analyzed successfully",
 *   "data": {
 *     "myBoardDetections": [
 *       { "tile_number": 5, "tile_color": "red", "confidence": 0.95 },
 *       ...
 *     ],
 *     "sharedBoardDetections": [ ... ]
 *   }
 * }
 */
router.post(
  '/analyze',
  authMiddleware as any,
  upload.fields([
    { name: 'myBoard', maxCount: 1 },
    { name: 'sharedBoard', maxCount: 1 },
  ]),
  VisionController.analyzeBoards as any
);

router.post(
  '/feedback',
  authMiddleware as any,
  upload.fields([
    { name: 'rackImage', maxCount: 1 },
    { name: 'boardImage', maxCount: 1 },
  ]),
  VisionController.submitFeedback as any
);

/**
 * GET /api/vision/health
 * 
 * Check if the vision service is available and responding.
 * 
 * Authentication: Required (JWT token)
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Vision service is available"
 * }
 */
router.get('/health', authMiddleware as any, VisionController.healthCheck as any);

export default router;
