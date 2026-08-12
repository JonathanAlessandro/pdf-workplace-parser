import dotenv from 'dotenv';

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'quickfiller',
    password: process.env.MYSQL_PASSWORD || 'quickfiller',
    database: process.env.MYSQL_DATABASE || 'quickfiller',
  },
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024),
  storageDir: process.env.STORAGE_DIR || 'storage',
  retentionHours: Number(process.env.RETENTION_HOURS || 24),
  ocrLanguage: process.env.OCR_LANGUAGE || 'por',
  ocrTimeoutMs: Number(process.env.OCR_TIMEOUT_MS || 120000),
  pdfParseTimeoutMs: Number(process.env.PDF_PARSE_TIMEOUT_MS || 60000),
  minTextLength: Number(process.env.MIN_TEXT_LENGTH || 20),
  workerPollMs: Number(process.env.WORKER_POLL_MS || 2000),
  workerLockTimeoutMs: Number(process.env.WORKER_LOCK_TIMEOUT_MS || 300000),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 20),
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
};

export default env;
