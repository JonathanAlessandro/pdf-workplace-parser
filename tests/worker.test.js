import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPool } from '../src/config/database.js';
import * as jobService from '../src/services/jobService.js';
import * as transcriptionModel from '../src/models/transcriptionModel.js';
import { v4 as uuidv4 } from 'uuid';

let dbAvailable = false;

beforeAll(async () => {
  try {
    await getPool().query('SELECT 1');
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
});

afterAll(async () => {
  try {
    await getPool().end();
  } catch {
    // ignore
  }
});

describe('worker job claiming', () => {
  it.skipIf(!dbAvailable)('dois claimJobs simultâneos não retornam o mesmo job', async () => {
    const id = uuidv4();
    await transcriptionModel.createTranscription({
      id,
      type: 'cartao-ponto',
      filePath: 'storage/uploads/test.pdf',
      expiresAt: new Date(Date.now() + 3600000),
    });
    await jobService.createJobForTranscription(id);

    const [job1, job2] = await Promise.all([jobService.claimJob(), jobService.claimJob()]);
    const ids = [job1?.id, job2?.id].filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
