import { Router } from 'express';
import { SolverController } from '../controllers/solverController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Solver
 *   description: ILP board solving and board-state validation
 */

/**
 * @swagger
 * /api/solver/solve:
 *   post:
 *     summary: Find the move that plays the maximum number of rack tiles
 *     description: >
 *       Forwards the current game state (rack + board sets) to the ILP
 *       solver running in the Python service and returns the rearranged
 *       board and the set of rack tiles that can be played.
 *     tags: [Solver]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GameState'
 *     responses:
 *       200:
 *         description: Solution calculated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SolveResponse'
 *       500:
 *         description: The solver service failed to produce a solution
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.post('/solve', authMiddleware as any, SolverController.solve);

/**
 * @swagger
 * /api/solver/validate:
 *   post:
 *     summary: Validate that every set on the board is a legal run or group
 *     tags: [Solver]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GameState'
 *     responses:
 *       200:
 *         description: Validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Game state validated successfully' }
 *                 data:
 *                   type: object
 *                   properties:
 *                     status: { type: string, enum: [success, error] }
 *                     invalid_sets:
 *                       type: array
 *                       items: { type: object }
 *       500:
 *         description: The validation service failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.post('/validate', authMiddleware as any, SolverController.validate);

export default router;
