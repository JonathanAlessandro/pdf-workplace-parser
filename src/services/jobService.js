import * as jobModel from '../models/jobModel.js';
import { getPool } from '../config/database.js';

export async function createJobForTranscription(transcriptionId) {
  return jobModel.createJob({ transcriptionId });
}

export async function claimJob() {
  const connection = await getPool().getConnection();
  try {
    return await jobModel.claimNextJob(connection);
  } finally {
    connection.release();
  }
}

export async function completeJob(jobId) {
  return jobModel.completeJob(jobId);
}

export async function failJob(jobId, errorMessage) {
  return jobModel.failJob(jobId, errorMessage);
}

export async function retryJob(jobId) {
  return jobModel.resetJobToPending(jobId);
}

export async function getJobByTranscriptionId(transcriptionId) {
  return jobModel.findByTranscriptionId(transcriptionId);
}
