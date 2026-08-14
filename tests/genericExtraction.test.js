import { describe, expect, it } from 'vitest';
import {
  buildDocumentSummary,
  buildGenericPage,
} from '../src/services/genericExtractionService.js';

describe('genericExtractionService', () => {
  it('extrai entidades e linhas de um documento desconhecido', () => {
    const page = buildGenericPage({
      pageNumber: 1,
      source: 'embedded',
      rawText: 'Cliente: Maria Silva\nData: 12/08/2026\nTotal: R$ 1.234,56\nContato: maria@example.com',
    });

    expect(page.lines).toHaveLength(4);
    expect(page.entities.some((item) => item.type === 'date')).toBe(true);
    expect(page.entities.some((item) => item.type === 'money')).toBe(true);
    expect(page.entities.some((item) => item.type === 'email')).toBe(true);
    expect(page.keyValues).toHaveLength(4);
  });

  it('classifica e resume páginas sem depender de tipo especializado', () => {
    const pages = [
      {
        page: 1,
        generic: buildGenericPage({
          pageNumber: 1,
          source: 'embedded',
          rawText: 'Contrato de prestação de serviços\nContratante: Empresa X\nCláusula 1: objeto',
        }),
      },
    ];
    const summary = buildDocumentSummary(pages);

    expect(summary.classification.value).toBe('contrato');
    expect(summary.textLength).toBeGreaterThan(0);
  });
});
