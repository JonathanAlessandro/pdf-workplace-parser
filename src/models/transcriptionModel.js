import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../config/database.js';

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    result: row.result_json ? JSON.parse(JSON.stringify(row.result_json)) : null,
    errorMessage: row.error_message,
    filePath: row.file_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}

export async function createTranscription({ id = uuidv4(), type, filePath, expiresAt }) {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO transcriptions (id, type, status, file_path, expires_at)
     VALUES (:id, :type, 'processando', :filePath, :expiresAt)`,
    { id, type, filePath, expiresAt },
  );
  return findById(id);
}

export async function findById(id) {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT * FROM transcriptions WHERE id = :id', { id });
  return mapRow(rows[0]);
}

export async function updateStatus(id, { status, result = null, errorMessage = null }) {
  const pool = getPool();
  await pool.execute(
    `UPDATE transcriptions
     SET status = :status,
         result_json = :result,
         error_message = :errorMessage
     WHERE id = :id`,
    {
      id,
      status,
      result: result ? JSON.stringify(result) : null,
      errorMessage,
    },
  );
  return findById(id);
}

export async function updateResult(id, result) {
  const pool = getPool();
  await pool.execute(
    `UPDATE transcriptions SET result_json = :result, status = 'concluido', error_message = NULL WHERE id = :id`,
    { id, result: JSON.stringify(result) },
  );
  return findById(id);
}

export async function findExpired(beforeDate) {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT * FROM transcriptions WHERE expires_at < :beforeDate',
    { beforeDate },
  );
  return rows.map(mapRow);
}

export async function deleteById(id) {
  const pool = getPool();
  await pool.execute('DELETE FROM transcriptions WHERE id = :id', { id });
}
