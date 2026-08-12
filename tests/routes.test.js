import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { getPool } from '../src/config/database.js';
import { createMinimalPdf, createInvalidPdfBuffer, createCorruptedPdfBuffer } from './helpers/pdfFixtures.js';

let app;
let dbAvailable = false;

beforeAll(async () => {
  app = await createApp();
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    dbAvailable = true;
    await pool.query('DELETE FROM jobs');
    await pool.query('DELETE FROM transcriptions');
  } catch {
    dbAvailable = false;
  }
});

afterAll(async () => {
  try {
    await getPool().end();
  } catch {
    // ignore when DB unavailable
  }
});

describe('API routes', () => {
  it.skipIf(!dbAvailable)('POST /api/transcricoes retorna 202 e cria job', async () => {
    const response = await request(app)
      .post('/api/transcricoes')
      .field('tipo', 'cartao-ponto')
      .attach('arquivo', createMinimalPdf('21/05/2019 08:25 18:25'), {
        filename: 'test.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(202);
    expect(response.body.id).toBeTruthy();

    const getResponse = await request(app).get(`/api/transcricoes/${response.body.id}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.status).toBe('processando');
    expect(getResponse.body.value).toBeNull();
  });

  it('rejeita upload não PDF', async () => {
    const response = await request(app)
      .post('/api/transcricoes')
      .field('tipo', 'cartao-ponto')
      .attach('arquivo', Buffer.from('hello'), {
        filename: 'test.txt',
        contentType: 'text/plain',
      });

    expect([400, 500]).toContain(response.status);
  });

  it('rejeita magic bytes inválidos', async () => {
    const response = await request(app)
      .post('/api/transcricoes')
      .field('tipo', 'cartao-ponto')
      .attach('arquivo', createInvalidPdfBuffer(), {
        filename: 'bad.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(400);
  });

  it('rejeita PDF corrompido', async () => {
    const response = await request(app)
      .post('/api/transcricoes')
      .field('tipo', 'holerite')
      .attach('arquivo', createCorruptedPdfBuffer(), {
        filename: 'broken.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(400);
  });

  it.skipIf(!dbAvailable)('PUT atualiza resultado e export reflete mudança', async () => {
    const { processTranscriptionJob } = await import('../src/services/transcriptionService.js');
    const create = await request(app)
      .post('/api/transcricoes')
      .field('tipo', 'cartao-ponto')
      .attach('arquivo', createMinimalPdf(), { filename: 't.pdf', contentType: 'application/pdf' });

    const id = create.body.id;
    const transcription = await import('../src/models/transcriptionModel.js').then((m) => m.findById(id));
    await processTranscriptionJob(transcription, { simulate: true });

    const updatedValue = {
      pages: [
        {
          page: 1,
          days: [{ date_raw: '01/01/2020', punches: [{ kind: 'IN', time_raw: '09:00', time_hhmm: '09:00' }] }],
        },
      ],
    };

    const put = await request(app).put(`/api/transcricoes/${id}`).send({ value: updatedValue });
    expect(put.status).toBe(200);

    const jsonExport = await request(app).get(`/api/transcricoes/${id}/planilha?formato=json`);
    expect(jsonExport.status).toBe(200);
    expect(jsonExport.text).toContain('01/01/2020');
  });
});

describe('GET /healthz', () => {
  it('retorna 200 ou 503 conforme banco', async () => {
    const response = await request(app).get('/healthz');
    expect([200, 503]).toContain(response.status);
  });
});
