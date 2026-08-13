import { v4 as uuidv4 } from 'uuid';
import env from '../config/env.js';
import { getPool } from '../config/database.js';

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    transcriptionId: row.transcription_id,
    status: row.status,
    attempts: row.attempts,
    lockedAt: row.locked_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createJob({ transcriptionId, id = uuidv4() }) {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO jobs (id, transcription_id, status)
     VALUES (:id, :transcriptionId, 'pendente')`,
    { id, transcriptionId },
  );
  return findById(id);
}

export async function findById(id) {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT * FROM jobs WHERE id = :id', { id });
  return mapRow(rows[0]);
}

export async function findByTranscriptionId(transcriptionId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM jobs
     WHERE transcription_id = :transcriptionId
     ORDER BY created_at DESC
     LIMIT 1`,
    { transcriptionId },
  );
  return mapRow(rows[0]);
}

export async function completeJob(id) {
  const pool = getPool();
  await pool.execute(
    `UPDATE jobs
     SET status = 'concluido', finished_at = NOW(), locked_at = NULL
     WHERE id = :id`,
    { id },
  );
  return findById(id);
}

export async function failJob(id, errorMessage) {
  const pool = getPool();
  await pool.execute(
    `UPDATE jobs
     SET status = 'erro', finished_at = NOW(), locked_at = NULL, last_error = :errorMessage
     WHERE id = :id`,
    { id, errorMessage: errorMessage || 'Falha ao processar job' },
  );
  return findById(id);
}

export async function resetJobToPending(id) {
  const pool = getPool();
  await pool.execute(
    `UPDATE jobs
     SET status = 'pendente', locked_at = NULL, last_error = NULL
     WHERE id = :id`,
    { id },
  );
  return findById(id);
}

export async function claimNextJob(connection) {
  const lockTimeoutSeconds = Math.floor(env.workerLockTimeoutMs / 1000);

  await connection.beginTransaction();
  try {
    const [candidates] = await connection.execute(
      `SELECT id FROM jobs
       WHERE status = 'pendente'
          OR (status = 'processando' AND locked_at < DATE_SUB(NOW(), INTERVAL :lockTimeout SECOND))
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE`,
      { lockTimeout: lockTimeoutSeconds },
    );

    if (!candidates.length) {
      await connection.commit();
      return null;
    }

    const jobId = candidates[0].id;
    await connection.execute(
      `UPDATE jobs
       SET status = 'processando',
           locked_at = NOW(),
           started_at = COALESCE(started_at, NOW()),
           attempts = attempts + 1
       WHERE id = :id`,
      { id: jobId },
    );

    const [rows] = await connection.execute('SELECT * FROM jobs WHERE id = :id', { id: jobId });
    await connection.commit();
    return mapRow(rows[0]);
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}
