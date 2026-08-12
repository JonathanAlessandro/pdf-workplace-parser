import { describe, it, expect } from 'vitest';
import { isTextSufficient } from '../src/services/pdfTextService.js';
import env from '../src/config/env.js';

describe('pdfTextService OCR fallback decision', () => {
  it('considera texto insuficiente abaixo do limiar', () => {
    expect(isTextSufficient('abc')).toBe(false);
    expect(isTextSufficient('x'.repeat(env.minTextLength))).toBe(true);
  });
});
