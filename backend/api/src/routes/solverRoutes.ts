import { Router } from 'express';
import { SolverController } from '../controllers/solverController';

const router = Router();

router.post('/solve', SolverController.solve);

export default router;