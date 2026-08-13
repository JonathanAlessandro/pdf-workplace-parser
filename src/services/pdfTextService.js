import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
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

export async function extractPageText(filePath, pageNumber) {
  const doc = await loadPdfDocument(filePath);
  try {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = textItemsToLines(content.items);
    return text;
  } finally {
    await doc.destroy();
  }
}

export async function extractAllPagesText(filePath) {
  const doc = await loadPdfDocument(filePath);
  const pages = [];
  try {
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = textItemsToLines(content.items);
      pages.push({ pageNumber: i, text, source: text.length >= env.minTextLength ? 'embedded' : 'empty' });
    }
  } finally {
    await doc.destroy();
  }
  return pages;
}

export function isTextSufficient(text) {
  return String(text || '').trim().length >= env.minTextLength;
}

function textItemsToLines(items) {
  const rows = [];
  const tolerance = 2;

  for (const item of items) {
    const text = String(item.str || '').trim();
    if (!text) continue;

    const x = item.transform?.[4] ?? 0;
    const y = item.transform?.[5] ?? 0;
    let row = rows.find((candidate) => Math.abs(candidate.y - y) <= tolerance);

    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }

    row.items.push({ x, text });
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => row.items
      .sort((a, b) => a.x - b.x)
      .map((item) => item.text)
      .join(' ')
      .trim())
    .filter(Boolean)
    .join('\n');
}

