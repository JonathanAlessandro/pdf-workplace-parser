import rateLimit from 'express-rate-limit';
import env from '../config/env.js';

export const uploadRateLimitMiddleware = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente mais tarde.' },
});

export const rateLimitMiddleware = uploadRateLimitMiddleware;
