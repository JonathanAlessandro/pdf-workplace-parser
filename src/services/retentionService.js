import fs from 'fs/promises';
import env from '../config/env.js';
import * as transcriptionModel from '../models/transcriptionModel.js';
import { deleteFileIfExists, resolveUploadPath } from '../utils/fileStorage.js';
import { logger } from '../utils/logger.js';

export async function cleanupExpired() {
  const cutoff = new Date();
  const expired = await transcriptionModel.findExpired(cutoff);

  for (const item of expired) {
    try {
      const filePath = resolveUploadPath(item.filePath);
      await deleteFileIfExists(filePath);
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
    location: env.storageDir,
  };
}
