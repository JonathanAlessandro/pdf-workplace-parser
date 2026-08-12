import { describe, it, expect } from 'vitest';
import { buildTimeCardRows, buildPayrollRows } from '../src/services/spreadsheetService.js';

describe('spreadsheetService', () => {
  it('monta colunas dinâmicas para cartão de ponto', () => {
    const { headers } = buildTimeCardRows({
      pages: [
        {
          page: 1,
          days: [
            {
              date_raw: '01/01/2020',
              punches: [
                { kind: 'IN', time_raw: '08:00', time_hhmm: '08:00' },
                { kind: 'OUT', time_raw: '12:00', time_hhmm: '12:00' },
                { kind: 'IN', time_raw: '13:00', time_hhmm: '13:00' },
                { kind: 'OUT', time_raw: '18:00', time_hhmm: '18:00' },
              ],
            },
          ],
        },
      ],
    });
    expect(headers).toEqual(['Data', 'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2']);
  });

  it('monta colunas dinâmicas para holerite', () => {
    const { headers } = buildPayrollRows({
      pages: [
        {
          page: 1,
          year: '2020',
          month: '01',
          fields: [{ code: '0010', label: 'Salário Base', reference: '', value: '1.000,00' }],
          bases: [],
        },
        {
          page: 2,
          year: '2020',
          month: '02',
          fields: [{ code: '0998', label: 'INSS', reference: '', value: '100,00' }],
          bases: [],
        },
      ],
    });
    expect(headers).toEqual(['Pág.', 'Mês', 'Ano', 'Salário Base', 'INSS']);
  });
});
