const DATE_RE = /\b\d{1,2}[/. -]\d{1,2}(?:[/. -]\d{2,4})?\b/g;
const TIME_RE = /\b(?:[01]?\d|2[0-3])[:h.]\d{2}\b/gi;
const MONEY_RE = /(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}|(?:R\$\s*)?\d+,\d{2}|(?:R\$\s*)?\d+\.\d{2}/g;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /\b(?:\+?\d{1,3}\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[\s-]?\d{4}\b/g;
const ID_RE = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const NOISE_RE = /[^\p{L}\p{N}\s.,:;!?/()@#$%&*+\-_=]/gu;

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function confidenceFor(text, source) {
  const value = cleanText(text);
  if (!value) return 0;
  const suspicious = (value.match(/[?]{1,}|[^\p{L}\p{N}\s.,:;!?/()@#$%&*+\-_=]/gu) || []).length;
  const base = source === 'embedded' ? 0.98 : source === 'ocr' ? 0.58 : 0.35;
  return Math.max(0.05, Math.min(0.99, base - Math.min(0.35, suspicious / Math.max(value.length, 1))));
}

function entity(type, value, source, lineIndex, raw = value) {
  const confidence = confidenceFor(value, source);
  return {
    type,
    value,
    raw,
    source,
    line: lineIndex,
    confidence,
    needsReview: confidence < 0.8 || value.includes('?'),
  };
}

function extractEntities(text, source, lineIndex) {
  const entities = [];
  for (const value of text.match(DATE_RE) || []) entities.push(entity('date', value, source, lineIndex));
  for (const value of text.match(TIME_RE) || []) entities.push(entity('time', value, source, lineIndex));
  for (const value of text.match(MONEY_RE) || []) entities.push(entity('money', value, source, lineIndex));
  for (const value of text.match(EMAIL_RE) || []) entities.push(entity('email', value, source, lineIndex));
  for (const value of text.match(PHONE_RE) || []) entities.push(entity('phone', value, source, lineIndex));
  for (const value of text.match(ID_RE) || []) entities.push(entity('identifier', value, source, lineIndex));
  return entities;
}

function buildKeyValues(lines, source) {
  const result = [];
  for (const line of lines) {
    const match = line.text.match(/^\s*([^:|–—-]{2,80})\s*[:|–—-]\s*(.+)$/);
    if (!match) continue;
    const label = cleanText(match[1]);
    const value = cleanText(match[2]);
    if (label && value) {
      result.push({ label, value, source, line: line.index, confidence: confidenceFor(value, source) });
    }
  }
  return result;
}

function buildTables(lines, source) {
  const tableLines = lines.filter((line) =>
    line.items?.length >= 2 || line.columnGaps?.length >= 1 || /\s{3,}/.test(line.text),
  );
  if (tableLines.length < 2) return [];

  return [{
    source,
    confidence: source === 'embedded' ? 0.76 : 0.48,
    headers: tableLines[0]?.text || '',
    rows: tableLines.slice(1).map((line) => ({
      text: line.text,
      cells: line.items?.map((item) => item.text) || line.text.split(/\s{2,}/),
      line: line.index,
    })),
    needsReview: source !== 'embedded',
  }];
}

function classifyDocument(text, entities, keyValues, tables) {
  const value = text.toLowerCase();
  const scores = {
    'cartao-ponto': 0,
    holerite: 0,
    formulario: 0,
    'nota-fiscal': 0,
    contrato: 0,
    outro: 0.1,
  };

  if (/cart[aã]o\s+de\s+ponto|registro\s+de\s+ponto|jornada|entrada|sa[ií]da/.test(value)) scores['cartao-ponto'] += 0.65;
  if (/holerite|contracheque|sal[aá]rio|desconto|vencimento|inss|fgts/.test(value)) scores.holerite += 0.65;
  if (/formul[aá]rio|declara[cç][aã]o|assinatura|preenchimento/.test(value)) scores.formulario += 0.45;
  if (/nota fiscal|nf-e|danfe|emitente|destinat[aá]rio/.test(value)) scores['nota-fiscal'] += 0.65;
  if (/contrato|cl[aá]usula|contratante|contratado/.test(value)) scores.contrato += 0.65;
  if (tables.length) scores.formulario += 0.15;
  if (entities.filter((item) => item.type === 'money').length >= 3) scores.holerite += 0.15;

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [type, score] = sorted[0];
  return {
    value: type,
    confidence: Math.min(0.99, score),
    alternatives: sorted.slice(1, 4).map(([candidate, candidateScore]) => ({
      value: candidate,
      confidence: Math.min(0.99, candidateScore),
    })),
  };
}

export function scoreExtraction({ text = '', lines = [], entities = [], tables = [], source }) {
  const clean = cleanText(text);
  const validEntities = entities.filter((item) => !item.value.includes('?'));
  const lineScore = Math.min(0.3, lines.length / 30);
  const entityScore = Math.min(0.45, validEntities.length / 20);
  const tableScore = tables.length ? 0.15 : 0;
  const textScore = clean.length ? Math.min(0.25, clean.length / 2000) : 0;
  const sourceBonus = source === 'embedded' ? 0.1 : source === 'ocr' ? 0.03 : 0;
  return Number(Math.min(1, lineScore + entityScore + tableScore + textScore + sourceBonus).toFixed(3));
}

export function buildGenericPage({ pageNumber, rawText, source = 'unknown', layout = null }) {
  const text = String(rawText || '').trim();
  const sourceLines = layout?.lines || text.split(/\r?\n/).filter(Boolean).map((value, index) => ({
    index,
    text: cleanText(value),
    items: [],
    bbox: null,
  }));
  const lines = sourceLines.filter((line) => line.text).map((line, index) => ({
    index,
    text: cleanText(line.text),
    items: line.items || [],
    bbox: line.bbox || null,
    confidence: confidenceFor(line.text, source),
    needsReview: confidenceFor(line.text, source) < 0.8,
  }));
  const blocks = lines.map((line) => ({
    type: 'line',
    text: line.text,
    bbox: line.bbox,
    line: line.index,
    source,
    confidence: line.confidence,
    needsReview: line.needsReview,
  }));
  const entities = lines.flatMap((line) => extractEntities(line.text, source, line.index));
  const keyValues = buildKeyValues(lines, source);
  const tables = buildTables(lines, source);
  const score = scoreExtraction({ text, lines, entities, tables, source });

  return {
    page: pageNumber,
    rawText: text,
    source,
    blocks,
    lines,
    entities,
    keyValues,
    tables,
    score,
    needsReview: lines.length === 0 || score < 0.45 || entities.some((item) => item.needsReview),
  };
}

export function mergeGenericPages(primary, secondary) {
  if (!secondary) return primary;
  if (!primary || secondary.score > primary.score) return secondary;
  return {
    ...primary,
    alternatives: [secondary],
  };
}

export function buildDocumentSummary(pages) {
  const allText = pages.map((page) => page.generic?.rawText || '').join('\n');
  const entities = pages.flatMap((page) => page.generic?.entities || []);
  const tables = pages.flatMap((page) => page.generic?.tables || []);
  const keyValues = pages.flatMap((page) => page.generic?.keyValues || []);
  const classification = classifyDocument(allText, entities, keyValues, tables);
  const needsReview = pages.some((page) => page.generic?.needsReview);
  return {
    classification,
    entities,
    keyValues,
    tables,
    needsReview,
    pageCount: pages.length,
    textLength: allText.length,
    confidence: pages.length
      ? Number((pages.reduce((total, page) => total + (page.generic?.score || 0), 0) / pages.length).toFixed(3))
      : 0,
  };
}

export { NOISE_RE };
