import { Router } from 'express';
import { SolutionHistoryController } from '../controllers/solutionHistoryController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Solutions
 *   description: Saved solution history for the current user
 */

/**
 * @swagger
 * /api/solutions:
 *   post:
 *     summary: Save a solved game to the current user's history
 *     tags: [Solutions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [originalGameState, solution]
 *             properties:
 *               originalGameState:
 *                 $ref: '#/components/schemas/GameState'
 *               solution:
 *                 type: object
 *                 description: Solver output for this game state
 *     responses:
 *       201:
 *         description: Solution saved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Solution saved successfully' }
 *                 data: { $ref: '#/components/schemas/SolutionRecord' }
 *       401:
 *         description: Missing, invalid, or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: Failed to save the solution
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.post('/', authMiddleware as any, SolutionHistoryController.saveSolution as any);

/**
 * @swagger
 * /api/solutions:
 *   get:
 *     summary: List the current user's saved solutions, most recent first
 *     tags: [Solutions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Solutions loaded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Solutions loaded successfully' }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/SolutionRecord' }
 *       401:
 *         description: Missing, invalid, or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: Failed to load solutions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.get('/', authMiddleware as any, SolutionHistoryController.getMySolutions as any);

export default router;
