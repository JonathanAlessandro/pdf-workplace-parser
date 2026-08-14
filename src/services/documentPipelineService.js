import path from 'path';
import env from '../config/env.js';
import { getStoragePaths } from '../utils/fileStorage.js';
import { logger } from '../utils/logger.js';
import { extractAllPagesText, isTextSufficient } from './pdfTextService.js';
import { ocrPdfPageSafe } from './ocrService.js';
import {
  buildDocumentSummary,
  buildGenericPage,
  mergeGenericPages,
} from './genericExtractionService.js';
import * as timeCardExtractor from './extractors/timeCardExtractor.js';
import * as payrollExtractor from './extractors/payrollExtractor.js';

const extractors = {
  'cartao-ponto': timeCardExtractor,
  holerite: payrollExtractor,
};

function hasPageData(type, pageResult) {
  if (type === 'cartao-ponto') {
    return (pageResult.days || []).some((day) => (day.punches || []).length > 0);
  }
  if (type === 'holerite') {
    return (pageResult.fields || []).length > 0 || (pageResult.bases || []).length > 0;
  }
  return false;
}

function hasGenericData(page) {
  return (page?.generic?.rawText || '').length > 0 || (page?.generic?.entities || []).length > 0;
}

async function getOcrText(filePath, pageNumber) {
  const tmpDir = path.join(
    getStoragePaths().tmp,
    `ocr-${path.basename(filePath, '.pdf')}`,
  );
  return ocrPdfPageSafe(filePath, pageNumber, tmpDir);
}

export async function processDocument({ type = 'outro', filePath }) {
  const extractor = extractors[type];
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error('Timeout ao processar documento')),
      env.pdfParseTimeoutMs,
    );
  });

  const work = async () => {
    const embeddedPages = await extractAllPagesText(filePath);
    const pages = [];

    for (const embedded of embeddedPages) {
      let source = embedded.text ? 'embedded' : 'empty';
      let rawText = embedded.text;
      let generic = buildGenericPage({
        pageNumber: embedded.pageNumber,
        rawText,
        source,
        layout: embedded,
      });
      let specialized = extractor
        ? extractor.extractPage({
          pageNumber: embedded.pageNumber,
          rawText,
          source,
        })
        : null;

      const specializedNeedsOcr = extractor && (!isTextSufficient(rawText) || !hasPageData(type, specialized));
      const genericNeedsOcr = !rawText || generic.score < 0.38;

      if (specializedNeedsOcr || genericNeedsOcr) {
        const ocrResult = await getOcrText(filePath, embedded.pageNumber);
        if (ocrResult.source === 'ocr' && ocrResult.text) {
          const ocrGeneric = buildGenericPage({
            pageNumber: embedded.pageNumber,
            rawText: ocrResult.text,
            source: 'ocr',
          });
          const ocrSpecialized = extractor
            ? extractor.extractPage({
              pageNumber: embedded.pageNumber,
              rawText: ocrResult.text,
              source: 'ocr',
            })
            : null;

          const selectedGeneric = mergeGenericPages(generic, ocrGeneric);
          if (selectedGeneric === ocrGeneric || !hasGenericData({ generic })) {
            generic = ocrGeneric;
            rawText = ocrResult.text;
            source = 'ocr';
          }
          if (extractor && (!hasPageData(type, specialized) || hasPageData(type, ocrSpecialized))) {
            if (hasPageData(type, ocrSpecialized)) specialized = ocrSpecialized;
          }
        }
      }

      const pageResult = {
        ...(specialized || { page: embedded.pageNumber }),
        generic,
      };
      pages.push(pageResult);

      logger.info('page_processed', {
        page: embedded.pageNumber,
        source,
        textLength: rawText.length,
        lineCount: rawText.split(/\r?\n/).filter(Boolean).length,
        genericScore: generic.score,
        genericEntities: generic.entities.length,
        genericTables: generic.tables.length,
        extractedDays: pageResult.days?.length || 0,
        extractedPunches: pageResult.days?.reduce(
          (total, day) => total + (day.punches?.length || 0),
          0,
        ) || 0,
        extractedFields: pageResult.fields?.length || 0,
        extractedBases: pageResult.bases?.length || 0,
        needsReview: generic.needsReview,
      });
    }

    return {
      pages,
      summary: buildDocumentSummary(pages),
    };
  };

  return Promise.race([work(), timeoutPromise]);
}

export async function processDocumentSimulated({ type }) {
  if (type === 'cartao-ponto') {
    return {
      pages: [{
        page: 1,
        days: [{
          date_raw: '21/05/2019',
          punches: [
            { kind: 'IN', time_raw: '08:25', time_hhmm: '08:25' },
            { kind: 'OUT', time_raw: '18:25', time_hhmm: '18:25' },
          ],
        }],
        generic: buildGenericPage({
          pageNumber: 1,
          rawText: '21/05/2019 08:25 18:25',
          source: 'simulated',
        }),
      }],
      summary: { classification: { value: 'cartao-ponto', confidence: 1 }, needsReview: false },
    };
  }

  return {
    pages: [{
      page: 1,
      year: '2020',
      month: '01',
      fields: [{ code: '0010', label: 'Salário Base', reference: '220,00', value: '2.389,77' }],
      bases: [{ label: 'Base INSS', value: '2.545,68' }],
      generic: buildGenericPage({
        pageNumber: 1,
        rawText: 'Salário Base 220,00 2.389,77 Base INSS 2.545,68',
        source: 'simulated',
      }),
    }],
    summary: { classification: { value: 'holerite', confidence: 1 }, needsReview: false },
  };
}
