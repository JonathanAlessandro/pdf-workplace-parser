import { describe, it, expect } from 'vitest';
import {
  computeTimeCardWarnings,
  computePayrollWarnings,
  getWarningStyle,
} from '../src/services/warningService.js';

describe('warningService', () => {
  it('detecta batidas ímpares', () => {
    const warnings = computeTimeCardWarnings([
      {
        page: 1,
        days: [{ date_raw: '01/01/2020', punches: [{ kind: 'IN', time_raw: '08:00', time_hhmm: '08:00' }] }],
      },
    ]);
    expect(warnings[0].reasons).toContain('odd_punches');
  });

  it('detecta data não sequencial', () => {
    const warnings = computeTimeCardWarnings([
      {
        page: 1,
        days: [
          { date_raw: '01/01/2020', punches: [] },
          { date_raw: '05/01/2020', punches: [] },
        ],
      },
    ]);
    expect(warnings.some((w) => w.reasons.includes('non_sequential_date'))).toBe(true);
  });

  it('detecta mês não sequencial e dezembro→janeiro consecutivo', () => {
    const warnings = computePayrollWarnings([
      { page: 1, year: '2019', month: '12', fields: [], bases: [] },
      { page: 2, year: '2020', month: '01', fields: [], bases: [] },
      { page: 3, year: '2020', month: '03', fields: [], bases: [] },
    ]);
    expect(warnings.some((w) => w.page === 3 && w.reasons.includes('non_sequential_month'))).toBe(true);
    expect(warnings.some((w) => w.page === 2 && w.reasons.includes('non_sequential_month'))).toBe(false);
  });

  it('prioriza vermelho sobre amarelo', () => {
    expect(getWarningStyle(['odd_punches', 'non_sequential_date'])).toBe('red');
  });
});
