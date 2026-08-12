import { describe, it, expect } from 'vitest';
import {
  normalizeTime,
  parseDateRaw,
  isValidDateParts,
} from '../src/services/extractors/parseUtils.js';

describe('parseUtils', () => {
  it('preserva time_raw e normaliza time_hhmm', () => {
    const result = normalizeTime('8:5');
    expect(result.time_raw).toBe('8:5');
    expect(result.time_hhmm).toBe('08:05');
  });

  it('mantém incerteza por caractere', () => {
    const result = normalizeTime('0?:25');
    expect(result.time_raw).toBe('0?:25');
    expect(result.time_hhmm).toBe('0?:25');
  });

  it('não valida data impossível', () => {
    expect(isValidDateParts(38, 7, 2019)).toBe(false);
    expect(isValidDateParts(10, 13, 2019)).toBe(false);
    const parsed = parseDateRaw('38/07/2019');
    expect(parsed.valid).toBe(false);
  });
});
