const DATE_PATTERN = /(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/;
const TIME_PATTERN = /(\d{1,2}[:hH]\d{2}|\d{4})/g;
const MONEY_PATTERN = /(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2}|\?+)/g;

export function normalizeTime(raw) {
  if (!raw) return { time_raw: '', time_hhmm: '' };
  const timeRaw = String(raw).trim();
  let normalized = timeRaw
    .replace(/[hH]/g, ':')
    .replace(/\s/g, '');

  if (/^\d{4}$/.test(normalized) && !normalized.includes('?')) {
    normalized = `${normalized.slice(0, 2)}:${normalized.slice(2)}`;
  }

  const parts = normalized.split(':');
  if (parts.length === 2) {
    const hh = parts[0].padStart(2, '0');
    const mm = parts[1].padStart(2, '0');
    normalized = `${hh}:${mm}`;
  }

  return { time_raw: timeRaw, time_hhmm: normalized };
}

export function extractTimesFromLine(line) {
  const matches = [...line.matchAll(TIME_PATTERN)];
  return matches.map((m) => normalizeTime(m[1]));
}

export function extractDateFromLine(line) {
  const match = line.match(DATE_PATTERN);
  return match ? match[1].replace(/-/g, '/').replace(/\./g, '/') : null;
}

export function isValidDateParts(day, month, year) {
  if (String(day).includes('?') || String(month).includes('?') || String(year).includes('?')) {
    return false;
  }
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (Number.isNaN(d) || Number.isNaN(m) || Number.isNaN(y)) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const daysInMonth = new Date(y, m, 0).getDate();
  return d <= daysInMonth;
}

export function parseDateRaw(dateRaw) {
  if (!dateRaw) return null;
  const parts = dateRaw.split('/');
  if (parts.length !== 3) return null;
  let [day, month, year] = parts;
  if (year.length === 2) year = Number(year) > 50 ? `19${year}` : `20${year}`;
  return { day, month, year, valid: isValidDateParts(day, month, year) };
}

export function normalizeMonth(monthStr) {
  if (!monthStr) return '';
  const cleaned = String(monthStr).replace(/\?/g, '?').trim();
  if (cleaned.includes('?')) return cleaned.padStart(2, '?');
  const num = Number(cleaned);
  if (Number.isNaN(num) || num < 1 || num > 12) return cleaned;
  return String(num).padStart(2, '0');
}

export function extractMoneyValues(text) {
  return [...text.matchAll(MONEY_PATTERN)].map((m) => m[1]);
}

export { DATE_PATTERN, TIME_PATTERN, MONEY_PATTERN };
