import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as transcriptionController from '../controllers/transcriptionController.js';
import { uploadMiddleware } from '../middlewares/uploadMiddleware.js';
import { validatePdfMiddleware } from '../middlewares/validatePdfMiddleware.js';
import {
  validateCreateTranscription,
  validateUpdateTranscription,
  loadTranscriptionMiddleware,
} from '../middlewares/validateTranscriptionMiddleware.js';
import { rateLimitMiddleware } from '../middlewares/rateLimitMiddleware.js';
import { requestContextMiddleware } from '../middlewares/requestContextMiddleware.js';
import * as transcriptionModel from '../models/transcriptionModel.js';

const router = Router();

router.post(
  '/',
  requestContextMiddleware,
  rateLimitMiddleware,
  uploadMiddleware.single('arquivo'),
  validatePdfMiddleware,
  validateCreateTranscription,
  asyncHandler(transcriptionController.create),
);

router.get('/:id/detalhe', asyncHandler(transcriptionController.getDetail));

router.get('/:id/pdf', asyncHandler(transcriptionController.getPdf));

router.get('/:id/planilha', asyncHandler(transcriptionController.downloadSpreadsheet));

router.get('/:id', asyncHandler(transcriptionController.getById));

router.put(
  '/:id',
  loadTranscriptionMiddleware(transcriptionModel.findById),
  validateUpdateTranscription,
  asyncHandler(transcriptionController.update),
);

export default router;
