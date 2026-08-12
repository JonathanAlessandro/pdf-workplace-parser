import env from '../config/env.js';

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
    return rows[0]
      ? {
          id: rows[0].id,
          transcriptionId: rows[0].transcription_id,
          status: rows[0].status,
          attempts: rows[0].attempts,
          lockedAt: rows[0].locked_at,
          startedAt: rows[0].started_at,
          finishedAt: rows[0].finished_at,
          lastError: rows[0].last_error,
        }
      : null;
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}
