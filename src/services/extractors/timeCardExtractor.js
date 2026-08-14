import {
  extractDateFromLine,
  extractTimesFromLine,
  parseDateRaw,
} from './parseUtils.js';

const MONTH_YEAR_RE = /(?:mes\s*\/\s*ano|compet[eê]ncia)\s*:\s*(\d{1,2})\s*\/\s*(\d{4})/i;
const DAY_ONLY_RE = /^(\d{1,2})\s*[-–]\s*(?:DOM|SEG|TER|QUA|QUI|SEX|SAB|FER)\b/i;

function normalizeLabel(label) {
  return String(label || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

function assignPunchKinds(times) {
  return times.map((time, index) => ({
    kind: index % 2 === 0 ? 'IN' : 'OUT',
    ...time,
  }));
}

function buildDateFromMonthYear(day, month, year) {
  if (!month || !year) return `${String(day).padStart(2, '0')}/??/????`;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

function extractMonthYear(lines) {
  for (const line of lines) {
    const match = line.match(MONTH_YEAR_RE) || line.match(/\b(\d{1,2})\s*\/\s*(\d{4})\b/);
    if (match) return { month: match[1], year: match[2] };
  }
  return { month: '', year: '' };
}

function getTimesForDayLine(line, isContinuation = false) {
  const times = extractTimesFromLine(line);
  // Em linhas iniciadas por dia, o primeiro horário normalmente é a jornada prevista
  // (por exemplo, 08:00). As batidas reais começam depois dele.
  if (!isContinuation && times.length < 2) return [];
  const punches = !isContinuation && times.length >= 2 ? times.slice(1) : times;
  // Os horários de ocorrência (por exemplo, 00:13) vêm depois do texto da ocorrência.
  // Em layouts de ponto, as duas primeiras horas da linha são as batidas da linha.
  return punches.slice(0, 2);
}

function pushDay(days, day) {
  if (!day) return;
  const existing = days.find((item) => item.date_raw === day.date_raw);
  if (existing) {
    existing.punches.push(...day.punches);
    return;
  }
  days.push(day);
}

export function extractPage({ pageNumber, rawText }) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const { month, year } = extractMonthYear(lines);
  const days = [];
  let currentDay = null;

  for (const line of lines) {
    const dayMatch = line.match(DAY_ONLY_RE);
    if (dayMatch) {
      const dayNumber = Number(dayMatch[1]);
      const dateRaw = buildDateFromMonthYear(dayNumber, month, year);
      const times = getTimesForDayLine(line.replace(dayMatch[0], '').trim());
      currentDay = { date_raw: dateRaw, punches: assignPunchKinds(times) };
      pushDay(days, currentDay);
      continue;
    }

    // Linhas seguintes como "15:12 18:36" pertencem ao último dia identificado.
    if (currentDay && /^\s*(?:\d{1,2}[:hH]\d{2}|\d{4})/.test(line)) {
      const times = getTimesForDayLine(line, true);
      const existing = days.find((item) => item.date_raw === currentDay.date_raw);
      if (existing) {
        const nextIndex = existing.punches.length;
        existing.punches.push(...times.map((time, index) => ({
          kind: (nextIndex + index) % 2 === 0 ? 'IN' : 'OUT',
          ...time,
        })));
      }
      continue;
    }

    // Compatibilidade com documentos que trazem a data completa na própria linha.
    const dateRaw = extractDateFromLine(line);
    if (dateRaw) {
      const dateWithoutDatePart = line.replace(dateRaw, ' ').trim();
      const times = extractTimesFromLine(dateWithoutDatePart);
      if (times.length) pushDay(days, { date_raw: dateRaw, punches: assignPunchKinds(times) });
    }
  }

  return { page: pageNumber, days };
}

export { normalizeLabel, parseDateRaw };
