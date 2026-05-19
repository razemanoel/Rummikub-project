import { Router } from 'express';
import { SolutionHistoryController } from '../controllers/solutionHistoryController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/', authMiddleware as any, SolutionHistoryController.saveSolution as any);
router.get('/', authMiddleware as any, SolutionHistoryController.getMySolutions as any);

export default router;