import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { healthz } from '../controllers/healthController.js';

const router = Router();
router.get('/', asyncHandler(healthz));

export default router;
