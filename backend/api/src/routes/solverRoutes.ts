import { Router } from 'express';
import { SolverController } from '../controllers/solverController';

const router = Router();

router.post('/solve', SolverController.solve);
router.post('/validate', SolverController.validate);

export default router;