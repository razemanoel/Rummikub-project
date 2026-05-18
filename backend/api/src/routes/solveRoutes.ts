import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { SolveController } from '../controllers/solveController';

const router = Router();

// POST /api/solve
router.post('/', authMiddleware, SolveController.solveGameState);

export default router;
