import {
  extractDateFromLine,
  extractTimesFromLine,
  parseDateRaw,
} from './parseUtils.js';

const BASE_LABELS = new Set([
  'base inss',
  'base ir',
  'base irrf',
  'fgts',
  'total vencimentos',
  'total descontos',
  'valor liquido',
  'salario liquido',
]);

function normalizeLabel(label) {
  return String(label || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

export function isBaseLabel(label) {
  const normalized = normalizeLabel(label);
  if (BASE_LABELS.has(normalized)) return true;
  return [...BASE_LABELS].some((base) => normalized.includes(base));
}

function isLikelyDayLine(line) {
  return /\d{1,2}[/.-]\d{1,2}/.test(line);
}

function assignPunchKinds(times) {
  return times.map((time, index) => ({
    kind: index % 2 === 0 ? 'IN' : 'OUT',
    ...time,
  }));
}

export function extractPage({ pageNumber, rawText }) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const days = [];

  for (const line of lines) {
    if (!isLikelyDayLine(line)) continue;
    const dateRaw = extractDateFromLine(line);
    if (!dateRaw) continue;

    const dateWithoutDatePart = line.replace(dateRaw, ' ').trim();
    const times = extractTimesFromLine(dateWithoutDatePart);
    const punches = assignPunchKinds(times);

    days.push({ date_raw: dateRaw, punches });
  }

  if (days.length === 0 && lines.length > 0) {
    for (const line of lines) {
      const dateRaw = extractDateFromLine(line);
      if (dateRaw) {
        days.push({ date_raw: dateRaw, punches: [] });
      }
    }
  }

  return { page: pageNumber, days };
}

export { parseDateRaw };
