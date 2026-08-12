import multer from 'multer';
import env from '../config/env.js';
import { logger, sanitizeErrorMessage } from '../utils/logger.js';

export function errorHandlerMiddleware(err, req, res, _next) {
  logger.error('request_error', {
    requestId: req.requestId,
    message: sanitizeErrorMessage(err),
    code: err.code,
  });

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `Arquivo excede o limite de ${env.maxUploadBytes} bytes` });
    }
    return res.status(400).json({ error: 'Erro no upload do arquivo' });
  }

  if (err.message?.includes('Arquivo inválido')) {
    return res.status(400).json({ error: err.message });
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: sanitizeErrorMessage(err) });
  }

  const status = err.status || 500;
  const message = status >= 500 ? sanitizeErrorMessage(err) : err.message;
  return res.status(status).json({ error: message });
}
