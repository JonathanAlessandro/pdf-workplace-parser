import { getPool } from '../src/config/database.js';

const migrations = [
  `CREATE TABLE IF NOT EXISTS transcriptions (
    id VARCHAR(36) PRIMARY KEY,
    type ENUM('cartao-ponto', 'holerite') NOT NULL,
    status ENUM('processando', 'concluido', 'erro') NOT NULL DEFAULT 'processando',
    result_json JSON NULL,
    error_message TEXT NULL,
    file_path VARCHAR(512) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    INDEX idx_transcriptions_status (status),
    INDEX idx_transcriptions_expires (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(36) PRIMARY KEY,
    transcription_id VARCHAR(36) NOT NULL,
    status ENUM('pendente', 'processando', 'concluido', 'erro') NOT NULL DEFAULT 'pendente',
    attempts INT NOT NULL DEFAULT 0,
    locked_at DATETIME NULL,
    started_at DATETIME NULL,
    finished_at DATETIME NULL,
    last_error TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_jobs_status (status),
    INDEX idx_jobs_transcription (transcription_id),
    CONSTRAINT fk_jobs_transcription FOREIGN KEY (transcription_id)
      REFERENCES transcriptions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

async function run() {
  const pool = getPool();
  for (const sql of migrations) {
    await pool.query(sql);
  }
  console.log('Migrations applied successfully');
  await pool.end();
}

run().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});
