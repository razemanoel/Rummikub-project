import { Router } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { VisionController } from '../controllers/visionController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Vision
 *   description: Photo upload, tile detection, and detection-correction feedback
 */

/**
 * Configure multer for handling file uploads
 * - Limits: 10MB per file, 20MB total
 * - Accepts any image/* MIME type
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
  },
  fileFilter: (req: any, file: any, cb: FileFilterCallback): void => {
    if (typeof file.mimetype === 'string' && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image uploads are allowed') as any, false);
    }
  },
});

/**
 * @swagger
 * /api/vision/analyze:
 *   post:
 *     summary: Detect tiles in a rack photo and/or a shared-board photo
 *     description: >
 *       Forwards the uploaded image(s) to the Python vision service
 *       (YOLOv8 detector + ResNet18 classifier), reconstructs the game
 *       state, and runs board validation. At least one of the two images
 *       must be supplied.
 *     tags: [Vision]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               myBoard:
 *                 type: string
 *                 format: binary
 *                 description: Photo of the player's rack (optional if sharedBoard is given)
 *               sharedBoard:
 *                 type: string
 *                 format: binary
 *                 description: Photo of the shared board (optional if myBoard is given)
 *     responses:
 *       200:
 *         description: Detection + reconstruction succeeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VisionAnalyzeResponse'
 *       400:
 *         description: No image supplied, or the vision service reported an error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         description: Missing, invalid, or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
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

/**
 * @swagger
 * /api/vision/feedback:
 *   post:
 *     summary: Submit corrections made during the detection review/edit screens
 *     description: >
 *       Stores the user's corrections (wrong class, wrong bounding box,
 *       missed tile, false positive, etc.) together with the original
 *       photos, so the dataset can be used to retrain the vision models.
 *     tags: [Vision]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [feedback]
 *             properties:
 *               feedback:
 *                 type: string
 *                 description: JSON-encoded feedback payload (corrections, model versions, final detections)
 *               rackImage:
 *                 type: string
 *                 format: binary
 *               boardImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Feedback saved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *       400:
 *         description: Malformed feedback payload or invalid image
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         description: Missing, invalid, or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
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
 * @swagger
 * /api/vision/health:
 *   get:
 *     summary: Check whether the Python vision service is reachable
 *     tags: [Vision]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vision service is available
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *       503:
 *         description: Vision service is unavailable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         description: Missing, invalid, or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.get('/health', authMiddleware as any, VisionController.healthCheck as any);

export default router;
