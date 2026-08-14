import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { createWorker } from 'tesseract.js';
import env from '../config/env.js';
import { logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);

async function renderPageWithPoppler(pdfPath, pageNumber, outputDir) {
  const prefix = path.join(outputDir, `page-${pageNumber}`);
  await execFileAsync('pdftoppm', [
    '-f', String(pageNumber),
    '-l', String(pageNumber),
    '-r', String(env.ocrDpi || 300),
    '-png',
    '-singlefile',
    pdfPath,
    prefix,
  ]);
  return `${prefix}.png`;
}

export function normalizeOcrText(rawText) {
  return String(rawText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

async function runOcrOnImage(imagePath) {
  const worker = await createWorker(env.ocrLanguage, 1, {
    logger: () => {},
  });

  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout ao processar documento')), env.ocrTimeoutMs);
    });
    const ocrPromise = worker.recognize(imagePath);
    const { data } = await Promise.race([ocrPromise, timeoutPromise]);
    return normalizeOcrText(data.text);
  } finally {
    await worker.terminate();
  }
}

export async function ocrPdfPage(pdfPath, pageNumber, tmpDir) {
  await fs.mkdir(tmpDir, { recursive: true });
  let imagePath;
  try {
    imagePath = await renderPageWithPoppler(pdfPath, pageNumber, tmpDir);
    const text = await runOcrOnImage(imagePath);
    return { text, source: 'ocr' };
  } catch (error) {
    logger.warn('ocr_page_failed', { pageNumber, message: error.message });
    throw new Error('Falha ao processar documento');
  } finally {
    if (imagePath) {
      await fs.unlink(imagePath).catch(() => {});
    }
  }
}

export async function ocrPdfPageSafe(pdfPath, pageNumber, tmpDir) {
  try {
    return await ocrPdfPage(pdfPath, pageNumber, tmpDir);
  } catch {
    return { text: '', source: 'ocr_failed' };
  }
}
