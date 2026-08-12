import path from 'path';
import env from '../config/env.js';
import { getStoragePaths } from '../utils/fileStorage.js';
import { logger } from '../utils/logger.js';
import { extractAllPagesText, isTextSufficient } from './pdfTextService.js';
import { ocrPdfPageSafe } from './ocrService.js';
import * as timeCardExtractor from './extractors/timeCardExtractor.js';
import * as payrollExtractor from './extractors/payrollExtractor.js';

const extractors = {
  'cartao-ponto': timeCardExtractor,
  holerite: payrollExtractor,
};

async function getPageText(filePath, pageNumber, embeddedText) {
  if (isTextSufficient(embeddedText)) {
    return { rawText: embeddedText, source: 'embedded' };
  }

  const tmpDir = path.join(getStoragePaths().tmp, `ocr-${path.basename(filePath, '.pdf')}`);
  const ocrResult = await ocrPdfPageSafe(filePath, pageNumber, tmpDir);
  return { rawText: ocrResult.text, source: ocrResult.source };
}

export async function processDocument({ type, filePath }) {
  const extractor = extractors[type];
  if (!extractor) {
    throw new Error('Tipo de documento inválido');
  }

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Timeout ao processar documento')), env.pdfParseTimeoutMs);
  });

  const work = async () => {
    const embeddedPages = await extractAllPagesText(filePath);
    const pages = [];

    for (const embedded of embeddedPages) {
      const { rawText, source } = await getPageText(filePath, embedded.pageNumber, embedded.text);
      logger.info('page_processed', {
        page: embedded.pageNumber,
        source,
        textLength: rawText.length,
      });
      const pageResult = extractor.extractPage({
        pageNumber: embedded.pageNumber,
        rawText,
        source,
      });
      pages.push(pageResult);
    }

    return { pages };
  };

  return Promise.race([work(), timeoutPromise]);
}

export async function processDocumentSimulated({ type }) {
  if (type === 'cartao-ponto') {
    return {
      pages: [
        {
          page: 1,
          days: [
            {
              date_raw: '21/05/2019',
              punches: [
                { kind: 'IN', time_raw: '08:25', time_hhmm: '08:25' },
                { kind: 'OUT', time_raw: '18:25', time_hhmm: '18:25' },
              ],
            },
          ],
        },
      ],
    };
  }

  return {
    pages: [
      {
        page: 1,
        year: '2020',
        month: '01',
        fields: [
          { code: '0010', label: 'Salário Base', reference: '220,00', value: '2.389,77' },
        ],
        bases: [{ label: 'Base INSS', value: '2.545,68' }],
      },
    ],
  };
}
