import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cors from 'cors';
import transcriptionRoutes from './routes/transcriptionRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import webRoutes from './routes/webRoutes.js';
import { notFoundMiddleware } from './middlewares/notFoundMiddleware.js';
import { errorHandlerMiddleware } from './middlewares/errorHandlerMiddleware.js';
import { requestContextMiddleware } from './middlewares/requestContextMiddleware.js';
import { ensureStorageDirs } from './utils/fileStorage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createApp() {
  await ensureStorageDirs();

  const app = express();

  // O Render fica na frente da aplicação como proxy reverso.
  // Confiamos somente no primeiro proxy para obter o IP real do cliente.
  app.set('trust proxy', 1);

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        frameSrc: ["'self'"],
        connectSrc: ["'self'"],
      },
    },
  }));
  app.use(cors());
  app.use(requestContextMiddleware);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, 'public')));

  app.use('/', webRoutes);
  app.use('/api/transcricoes', transcriptionRoutes);
  app.use('/healthz', healthRoutes);

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}
