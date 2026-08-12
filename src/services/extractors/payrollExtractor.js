import { extractMoneyValues, normalizeMonth } from './parseUtils.js';
import { isBaseLabel } from './timeCardExtractor.js';

const COMPETENCE_PATTERN = /(\d{2})\/(\d{4})|(\d{2})[-/](\d{2})[-/](\d{4})|compet[êe]ncia[:\s]+(\d{2})[/.-](\d{4})/i;
const CODE_PATTERN = /^(\d{3,4})\s+(.+)$/;

function parseCompetence(text) {
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines.slice(0, 15)) {
    const match = line.match(/(\d{2})[/.-](\d{4})/);
    if (match) {
      return { month: normalizeMonth(match[1]), year: match[2] };
    }
    const alt = line.match(/(\d{4})[/.-](\d{2})/);
    if (alt) {
      return { month: normalizeMonth(alt[2]), year: alt[1] };
    }
  }
  return { month: '', year: '' };
}

function parseFieldLine(line) {
  const trimmed = line.trim();
  if (!trimmed || isBaseLabel(trimmed)) return null;

  const codeMatch = trimmed.match(/^(\d{3,4})\s+(.+?)\s+([\d.,?]+(?:\s+[\d.,?]+)?)$/);
  if (codeMatch) {
    const [, code, rest, valuesPart] = codeMatch;
    const values = extractMoneyValues(valuesPart);
    const value = values[values.length - 1] || '';
    const reference = values.length > 1 ? values[0] : '';
    const label = rest.replace(/\s+[\d.,?]+$/, '').trim();
    return { code, label, reference, value };
  }

  const simpleMatch = trimmed.match(/^(.+?)\s+([\d.,?]+)$/);
  if (simpleMatch && extractMoneyValues(simpleMatch[2]).length) {
    return {
      code: '',
      label: simpleMatch[1].trim(),
      reference: '',
      value: simpleMatch[2].trim(),
    };
  }

  return null;
}

function parseBaseLine(line) {
  const trimmed = line.trim();
  const lower = trimmed.toLowerCase();
  if (!isBaseLabel(lower.split(/\s+/).slice(0, 3).join(' ')) && !isBaseLabel(lower)) {
    const baseMatch = trimmed.match(/(base\s+\w+|fgts|total\s+\w+|valor\s+l[ií]quido)\s+([\d.,?]+)/i);
    if (baseMatch) {
      return { label: baseMatch[1].replace(/\s+/g, ' ').replace(/^./, (c) => c.toUpperCase()), value: baseMatch[2] };
    }
    return null;
  }

  const values = extractMoneyValues(trimmed);
  if (!values.length) return null;
  const label = trimmed.replace(values[values.length - 1], '').replace(/\s+/g, ' ').trim();
  return { label, value: values[values.length - 1] };
}

export function extractPage({ pageNumber, rawText }) {
  const text = String(rawText || '');
  const { month, year } = parseCompetence(text);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const fields = [];
  const bases = [];
  const seenFieldLabels = new Set();
  const seenBaseLabels = new Set();

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (isBaseLabel(lower) || /base\s|fgts|total\s|valor\s+l[ií]quido/i.test(line)) {
      const base = parseBaseLine(line);
      if (base && !seenBaseLabels.has(base.label.toLowerCase())) {
        seenBaseLabels.add(base.label.toLowerCase());
        bases.push(base);
      }
      continue;
    }

    const field = parseFieldLine(line);
    if (field && !isBaseLabel(field.label)) {
      const key = `${field.code}|${field.label}`;
      if (!seenFieldLabels.has(key)) {
        seenFieldLabels.add(key);
        fields.push(field);
      }
    }
  }

  return { page: pageNumber, year, month, fields, bases };
}

export { COMPETENCE_PATTERN, CODE_PATTERN };
