import * as transcriptionService from '../services/transcriptionService.js';
import { pingDatabase } from '../config/database.js';

export async function create(req, res) {
  const result = await transcriptionService.createTranscription({
    tipo: req.body.tipo,
    file: req.file,
  });
  res.status(202).json(result);
}

export async function getById(req, res) {
  const transcription = await transcriptionService.getTranscription(req.params.id);
  if (!transcription) {
    return res.status(404).json({ error: 'Transcrição não encontrada' });
  }
  res.json(transcription);
}

export async function update(req, res) {
  const updated = await transcriptionService.updateTranscription(req.params.id, req.body.value);
  if (!updated) {
    return res.status(404).json({ error: 'Transcrição não encontrada' });
  }
  res.json(updated);
}

export async function downloadSpreadsheet(req, res) {
  const exportResult = await transcriptionService.exportSpreadsheet(
    req.params.id,
    req.query.formato,
  );
  res.setHeader('Content-Type', exportResult.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
  res.send(exportResult.body);
}

export async function getPdf(req, res) {
  const data = await transcriptionService.getTranscriptionWithWarnings(req.params.id);
  if (!data?.filePath) {
    return res.status(404).json({ error: 'Transcrição não encontrada' });
  }
  const { resolveUploadPath } = await import('../utils/fileStorage.js');
  const filePath = resolveUploadPath(data.filePath);
  res.setHeader('Content-Type', 'application/pdf');
  res.sendFile(filePath);
}

export async function getDetail(req, res) {
  const data = await transcriptionService.getTranscriptionWithWarnings(req.params.id);
  if (!data) {
    return res.status(404).json({ error: 'Transcrição não encontrada' });
  }
  res.json(data);
}

export async function healthz(_req, res) {
  try {
    await pingDatabase();
    res.status(200).json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'error', message: 'Banco indisponível' });
  }
}
