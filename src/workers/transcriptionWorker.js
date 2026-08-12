import * as jobService from '../services/jobService.js';
import * as transcriptionModel from '../models/transcriptionModel.js';
import * as transcriptionService from '../services/transcriptionService.js';
import { cleanupExpired } from '../services/retentionService.js';
import env from '../config/env.js';
import { logger, sanitizeErrorMessage } from '../utils/logger.js';

const simulateProcessing = process.env.SIMULATE_PROCESSING === 'true';

async function processOnce() {
  const job = await jobService.claimJob();
  if (!job) return false;

  const transcription = await transcriptionModel.findById(job.transcriptionId);
  if (!transcription) {
    await jobService.failJob(job.id, 'Transcrição não encontrada');
    return true;
  }

  logger.info('job_started', {
    jobId: job.id,
    transcriptionId: transcription.id,
    type: transcription.type,
    attempt: job.attempts,
  });

  try {
    await transcriptionService.processTranscriptionJob(transcription, {
      simulate: simulateProcessing,
    });
    await jobService.completeJob(job.id);
    logger.info('job_completed', {
      jobId: job.id,
      transcriptionId: transcription.id,
      durationMs: Date.now(),
    });
  } catch (error) {
    await jobService.failJob(job.id, sanitizeErrorMessage(error));
    logger.error('job_failed', {
      jobId: job.id,
      transcriptionId: transcription.id,
      message: sanitizeErrorMessage(error),
    });
  }

  return true;
}

async function loop() {
  try {
    await cleanupExpired();
    const processed = await processOnce();
    if (!processed) {
      await new Promise((resolve) => setTimeout(resolve, env.workerPollMs));
    }
  } catch (error) {
    logger.error('worker_loop_error', { message: error.message });
    await new Promise((resolve) => setTimeout(resolve, env.workerPollMs));
  }
  loop();
}

logger.info('worker_started', { pollMs: env.workerPollMs, simulate: simulateProcessing });
loop();
