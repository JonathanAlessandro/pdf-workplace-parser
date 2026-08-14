import { describe, it, expect } from 'vitest';
import * as payrollExtractor from '../src/services/extractors/payrollExtractor.js';

describe('payrollExtractor', () => {
  it('separa fields de bases', () => {
    const text = `
      Competência 01/2020
      0010 Salário Base 220,00 2.389,77
      0998 INSS 262,87
      Base INSS 2.545,68
      Valor Líquido 2.282,81
    `;
    const page = payrollExtractor.extractPage({ pageNumber: 1, rawText: text });
    expect(page.fields.some((f) => f.label.toLowerCase().includes('salario'))).toBe(true);
    expect(page.fields.some((f) => f.label.toLowerCase().includes('base inss'))).toBe(false);
    expect(page.bases.some((b) => b.label.toLowerCase().includes('base inss'))).toBe(true);
    expect(page.bases.some((b) => b.label.toLowerCase().includes('valor liquido'))).toBe(true);
  });
});
