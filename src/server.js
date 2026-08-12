import env from './config/env.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

const app = await createApp();

app.listen(env.port, () => {
  logger.info('server_started', { port: env.port, env: env.nodeEnv });
});
