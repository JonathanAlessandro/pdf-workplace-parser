import env from '../config/env.js';
import * as transcriptionModel from '../models/transcriptionModel.js';
import { deleteFileIfExists } from '../utils/fileStorage.js';
import { logger } from '../utils/logger.js';

export async function cleanupExpired() {
  const cutoff = new Date();
  const expired = await transcriptionModel.findExpired(cutoff);

  for (const item of expired) {
    try {
      await deleteFileIfExists(item.filePath);
      await transcriptionModel.deleteById(item.id);
      logger.info('retention_deleted', { transcriptionId: item.id });
    } catch (error) {
      logger.warn('retention_delete_failed', {
        transcriptionId: item.id,
        message: error.message,
      });
    }
  }

  return expired.length;
}

export function getExpiresAt() {
  const expires = new Date();
  expires.setHours(expires.getHours() + env.retentionHours);
  return expires;
}

export function getRetentionPolicy() {
  return {
    hours: env.retentionHours,
    stored: ['PDF original', 'JSON de transcrição', 'metadados no MySQL'],
    location: env.s3.enabled ? `s3://${env.s3.bucket}/${env.s3.prefix}` : env.storageDir,
  };
}
