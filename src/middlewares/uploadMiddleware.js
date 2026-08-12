import multer from 'multer';
import { randomUUID } from 'crypto';
import path from 'path';
import env from '../config/env.js';
import { ensureStorageDirs, getStoragePaths } from '../utils/fileStorage.js';

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await ensureStorageDirs();
      cb(null, getStoragePaths().tmp);
    } catch (error) {
      cb(error);
    }
  },
  filename: (_req, _file, cb) => {
    cb(null, `${randomUUID()}.pdf`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext !== '.pdf') {
    return cb(new Error('Arquivo inválido: extensão deve ser .pdf'));
  }
  if (file.mimetype && file.mimetype !== 'application/pdf') {
    return cb(new Error('Arquivo inválido: MIME deve ser application/pdf'));
  }
  cb(null, true);
}

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: env.maxUploadBytes },
  fileFilter,
});
