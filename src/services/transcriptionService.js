import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import * as transcriptionModel from '../models/transcriptionModel.js';
import * as jobService from './jobService.js';
import {
  materializePdf,
  removeTempDir,
  saveUploadedPdf,
} from '../utils/fileStorage.js';
import { getExpiresAt } from './retentionService.js';
import { processDocument } from './documentPipelineService.js';
import { buildSpreadsheet, getWarningsForValue } from './spreadsheetService.js';
import { sanitizeErrorMessage } from '../utils/logger.js';
import { spreadsheetFormatSchema } from '../validators/documentSchemas.js';

function hasExtractedData(type, result) {
  return (result?.pages || []).some((page) => {
    const specializedData = type === 'cartao-ponto'
      ? (page.days || []).some((day) => (day.punches || []).length > 0)
      : type === 'holerite'
        ? (page.fields || []).length > 0 || (page.bases || []).length > 0
        : false;

    if (specializedData) return true;

    return Boolean(
      page.generic?.rawText
      || page.generic?.entities?.length
      || page.generic?.tables?.length,
    );
  });
}

export async function createTranscription({ tipo, file }) {
  const id = uuidv4();
  const buffer = file.buffer || (await fs.readFile(file.path));
  const storageRef = await saveUploadedPdf(buffer, id);

  await transcriptionModel.createTranscription({
    id,
    type: tipo,
    filePath: storageRef,
    expiresAt: getExpiresAt(),
  });

  await jobService.createJobForTranscription(id);

  if (file.path) {
    await fs.unlink(file.path).catch(() => {});
  }

  return { id };
}

export async function getTranscription(id) {
  const transcription = await transcriptionModel.findById(id);
  if (!transcription) return null;

  return {
    id: transcription.id,
    tipo: transcription.type,
    status: transcription.status,
    erro: transcription.errorMessage,
    value: transcription.status === 'concluido' ? transcription.result : null,
  };
}

export async function getTranscriptionWithWarnings(id) {
  const transcription = await transcriptionModel.findById(id);
  if (!transcription) return null;
  const publicData = await getTranscription(id);
  const warnings =
    transcription.result && transcription.status === 'concluido'
      ? getWarningsForValue(transcription.type, transcription.result)
      : [];
  return { ...publicData, warnings, filePath: transcription.filePath };
}

export async function updateTranscription(id, value) {
  const existing = await transcriptionModel.findById(id);
  if (!existing) return null;
  await transcriptionModel.updateResult(id, value);
  return getTranscription(id);
}

export async function exportSpreadsheet(id, formato) {
  const parsedFormat = spreadsheetFormatSchema.safeParse(formato || 'xlsx');
  if (!parsedFormat.success) {
    const error = new Error('Formato inválido');
    error.statusCode = 400;
    throw error;
  }

  const transcription = await transcriptionModel.findById(id);
  if (!transcription) {
    const error = new Error('Transcrição não encontrada');
    error.statusCode = 404;
    throw error;
  }
  if (transcription.status !== 'concluido' || !transcription.result) {
    const error = new Error('Transcrição ainda não concluída');
    error.statusCode = 400;
    throw error;
  }

  return buildSpreadsheet(transcription.type, transcription.result, parsedFormat.data);
}

export async function processTranscriptionJob(transcription, options = {}) {
  const { simulate = false } = options;
  let materialized;
  try {
    let result;

    if (simulate) {
      result = await (await import('./documentPipelineService.js')).processDocumentSimulated({
        type: transcription.type,
      });
    } else {
      materialized = await materializePdf(transcription.filePath, transcription.id);
      result = await processDocument({
        type: transcription.type,
        filePath: materialized.filePath,
      });
    }

    if (!hasExtractedData(transcription.type, result)) {
      throw new Error('Nenhum dado reconhecido no documento');
    }

    await transcriptionModel.updateStatus(transcription.id, {
      status: 'concluido',
      result,
    });
    return result;
  } catch (error) {
    await transcriptionModel.updateStatus(transcription.id, {
      status: 'erro',
      errorMessage: sanitizeErrorMessage(error),
    });
    throw error;
  } finally {
    if (materialized?.tempDir) await removeTempDir(materialized.tempDir);
  }
}
