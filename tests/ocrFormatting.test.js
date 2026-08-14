import { describe, expect, it } from 'vitest';
import { normalizeOcrText } from '../src/services/ocrService.js';
import * as timeCardExtractor from '../src/services/extractors/timeCardExtractor.js';

describe('normalização do OCR', () => {
  it('preserva quebras de linha e reduz apenas espaços internos', () => {
    const result = normalizeOcrText(
      '01/05/2024   08:00  12:00\r\n\r\n02/05/2024\t08:05 12:03',
    );

    expect(result).toBe('01/05/2024 08:00 12:00\n02/05/2024 08:05 12:03');
  });

  it('mantém as batidas separadas por dia', () => {
    const rawText = normalizeOcrText(
      '01/05/2024   08:00  12:00  13:00  18:00\n02/05/2024 08:05 12:03 13:02 18:10',
    );
    const result = timeCardExtractor.extractPage({ pageNumber: 1, rawText });

    expect(result.days).toHaveLength(2);
    expect(result.days[0].punches).toHaveLength(4);
    expect(result.days[1].punches).toHaveLength(4);
  });
});
