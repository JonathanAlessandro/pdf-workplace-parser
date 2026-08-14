import fs from 'fs/promises';
import env from '../config/env.js';

let pdfjsLib;

async function getPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLib;
}

export async function loadPdfDocument(filePath) {
  const pdfjs = await getPdfJs();
  const buffer = await fs.readFile(filePath);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
  });
  return loadingTask.promise;
}

export async function getPageCount(filePath) {
  const doc = await loadPdfDocument(filePath);
  const count = doc.numPages;
  await doc.destroy();
  return count;
}

function median(values) {
  if (!values.length) return 10;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 10;
}

export function textItemsToLayout(items) {
  const normalizedItems = items
    .map((item, index) => {
      const text = String(item.str || '').replace(/\s+/g, ' ').trim();
      if (!text) return null;
      const x = Number(item.transform?.[4] || 0);
      const y = Number(item.transform?.[5] || 0);
      const width = Number(item.width || Math.max(text.length * 4, 1));
      const height = Number(item.height || Math.abs(item.transform?.[3] || 10));
      return {
        id: index,
        text,
        x,
        y,
        width,
        height,
        right: x + width,
        bottom: y - height,
      };
    })
    .filter(Boolean);

  const tolerance = Math.max(2, median(normalizedItems.map((item) => item.height)) * 0.45);
  const rows = [];

  for (const item of normalizedItems) {
    let row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
    if (!row) {
      row = { y: item.y, items: [] };
      rows.push(row);
    }
    row.items.push(item);
    row.y = (row.y + item.y) / 2;
  }

  const lines = rows
    .sort((a, b) => b.y - a.y)
    .map((row, lineIndex) => {
      const sorted = row.items.sort((a, b) => a.x - b.x);
      const gapThreshold = median(sorted.map((item) => item.height)) * 1.8;
      const text = sorted.map((item) => item.text).join(' ').trim();
      const x = Math.min(...sorted.map((item) => item.x));
      const y = Math.max(...sorted.map((item) => item.y));
      const right = Math.max(...sorted.map((item) => item.right));
      const bottom = Math.min(...sorted.map((item) => item.bottom));
      return {
        index: lineIndex,
        text,
        items: sorted,
        bbox: { x, y: bottom, width: right - x, height: y - bottom },
        columnGaps: sorted.slice(1).map((item, index) => item.x - sorted[index].right)
          .filter((gap) => gap > gapThreshold),
      };
    })
    .filter((line) => line.text);

  return {
    items: normalizedItems,
    lines,
    text: lines.map((line) => line.text).join('\n'),
  };
}

export async function extractPageLayout(filePath, pageNumber) {
  const doc = await loadPdfDocument(filePath);
  try {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const layout = textItemsToLayout(content.items);
    return { pageNumber, ...layout };
  } finally {
    await doc.destroy();
  }
}

export async function extractPageText(filePath, pageNumber) {
  const layout = await extractPageLayout(filePath, pageNumber);
  return layout.text;
}

export async function extractAllPagesText(filePath) {
  const doc = await loadPdfDocument(filePath);
  const pages = [];

  try {
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const layout = textItemsToLayout(content.items);
      pages.push({
        pageNumber: i,
        ...layout,
        source: layout.text.length >= env.minTextLength ? 'embedded' : 'empty',
      });
    }
  } finally {
    await doc.destroy();
  }

  return pages;
}

export function isTextSufficient(text) {
  const value = String(text || '').trim();
  if (value.length < env.minTextLength) return false;

  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const moneyValues = value.match(
    /(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2})/g,
  ) || [];
  const datesOrTimes = value.match(
    /(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}:\d{2}|\d{4})/g,
  ) || [];
  const meaningfulLines = lines.filter((line) => /[A-Za-zÀ-ÿ]{2,}/.test(line));

  return meaningfulLines.length >= 2 && (moneyValues.length >= 1 || datesOrTimes.length >= 1);
}
