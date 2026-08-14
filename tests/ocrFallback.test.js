import { describe, it, expect } from 'vitest';
import { isTextSufficient } from '../src/services/pdfTextService.js';

describe('pdfTextService OCR fallback decision', () => {
  it('considera texto insuficiente abaixo do limiar', () => {
    expect(isTextSufficient('abc')).toBe(false);
    expect(isTextSufficient('Data 12/08/2026\nHorário 08:30\nTotal 100,00')).toBe(true);
  });
});
