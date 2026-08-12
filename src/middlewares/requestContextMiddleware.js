import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';

export function requestContextMiddleware(req, res, next) {
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  const start = Date.now();

  res.on('finish', () => {
    logger.info('request_completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
    });
  });

  next();
}
