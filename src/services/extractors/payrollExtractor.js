import { extractMoneyValues, normalizeMonth } from './parseUtils.js';

const BASE_LABELS = [
  'base inss',
  'base irrf',
  'base fgts',
  'fgts',
  'total vencimentos',
  'total descontos',
  'valor liquido',
  'liquido a receber',
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForComparison(value) {
  return normalizeText(value).toLowerCase();
}

function parseCompetence(text) {
  const lines = String(text || '').split(/\r?\n/);

  for (const line of lines.slice(0, 30)) {
    const competence = line.match(/(\d{2})\s*[/.-]\s*(\d{4})/);
    if (competence) {
      return {
        month: normalizeMonth(competence[1]),
        year: competence[2],
      };
    }

    const reversed = line.match(/(\d{4})\s*[/.-]\s*(\d{2})/);
    if (reversed) {
      return {
        month: normalizeMonth(reversed[2]),
        year: reversed[1],
      };
    }
  }

  return { month: '', year: '' };
}

function isBaseLine(line) {
  const normalized = normalizeForComparison(line);
  return BASE_LABELS.some((label) => normalized.includes(label));
}

function isHeaderLine(line) {
  const normalized = normalizeForComparison(line);
  return (
    normalized.includes('descricao') ||
    normalized.includes('referencia') ||
    normalized.includes('quantidade') ||
    normalized === 'valor' ||
    normalized.includes('vencimentos') && normalized.includes('descontos')
  );
}

function getMoneyMatches(line) {
  const values = extractMoneyValues(line);
  if (!values.length) return [];
  return values;
}

function removeMoneyValues(text, values) {
  let result = String(text || '');
  for (const value of values) {
    result = result.replace(value, ' ');
  }
  return result.replace(/\s+/g, ' ').trim();
}

function parseFinancialLine(line) {
  const normalized = normalizeText(line);
  if (!normalized || isHeaderLine(normalized)) return null;

  const values = getMoneyMatches(normalized);
  if (!values.length) return null;

  const codeMatch = normalized.match(/^\s*(\d{3,4})\s+/);
  const code = codeMatch ? codeMatch[1] : '';
  const withoutCode = codeMatch
    ? normalized.slice(codeMatch[0].length)
    : normalized;

  const label = removeMoneyValues(withoutCode, values)
    .replace(/^[-:|]+|[-:|]+$/g, '')
    .trim();

  if (!label || label.length < 2) return null;

  return {
    code,
    label,
    reference: values.length > 1 ? values[values.length - 2] : '',
    value: values[values.length - 1],
  };
}

function parseBaseLine(line) {
  const normalized = normalizeText(line);
  const values = getMoneyMatches(normalized);
  if (!values.length) return null;

  const label = removeMoneyValues(normalized, values)
    .replace(/^[-:|]+|[-:|]+$/g, '')
    .trim();

  if (!label) return null;

  return {
    label,
    value: values[values.length - 1],
  };
}

export function extractPage({ pageNumber, rawText }) {
  const text = String(rawText || '');
  const { month, year } = parseCompetence(text);
  const lines = text
    .split(/\r?\n/)
    .map(normalizeText)
    .filter(Boolean);

  const fields = [];
  const bases = [];
  const seenFields = new Set();
  const seenBases = new Set();

  for (const line of lines) {
    if (isBaseLine(line)) {
      const base = parseBaseLine(line);
      if (base) {
        const key = normalizeForComparison(base.label);
        if (!seenBases.has(key)) {
          seenBases.add(key);
          bases.push(base);
        }
      }
      continue;
    }

    const field = parseFinancialLine(line);
    if (!field) continue;

    const key = `${field.code}|${normalizeForComparison(field.label)}`;
    if (!seenFields.has(key)) {
      seenFields.add(key);
      fields.push(field);
    }
  }

  return {
    page: pageNumber,
    year,
    month,
    fields,
    bases,
  };
}
