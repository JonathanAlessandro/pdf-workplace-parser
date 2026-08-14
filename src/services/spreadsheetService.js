import {
  computePayrollWarnings,
  computeTimeCardWarnings,
  getWarningStyle,
  warningReasonLabel,
} from './warningService.js';

const HEADER_FILL = 'FF173772';
const YELLOW_FILL = 'FFFFF3CD';
const RED_FILL = 'FFF8D7DA';
const RED_BORDER = 'FFDC3545';

function buildGenericRows(value) {
  const headers = ['Pág.', 'Linha', 'Texto', 'Tipos', 'Confiança', 'Revisão'];
  const rows = [];
  for (const page of value.pages || []) {
    for (const line of page.generic?.lines || []) {
      const entities = (page.generic?.entities || []).filter((item) => item.line === line.index);
      rows.push({
        cells: [
          page.page,
          line.index + 1,
          line.text,
          entities.map((item) => item.type).join(', '),
          `${Math.round((line.confidence || 0) * 100)}%`,
          line.needsReview ? 'SIM' : 'NAO',
        ],
        warning: line.needsReview,
        style: line.needsReview ? 'yellow' : null,
      });
    }
  }
  return { headers, rows };
}

function buildTimeCardRows(value) {
  const warnings = computeTimeCardWarnings(value.pages);
  const warningMap = new Map(warnings.map((w) => [`${w.page}-${w.dayIndex}`, w]));

  let maxPunches = 0;
  for (const page of value.pages || []) {
    for (const day of page.days || []) {
      maxPunches = Math.max(maxPunches, (day.punches || []).length);
    }
  }

  const headers = ['Data'];
  for (let i = 1; i <= Math.ceil(maxPunches / 2); i += 1) {
    headers.push(`Entrada ${i}`, `Saída ${i}`);
  }

  const rows = [];
  for (const page of value.pages || []) {
    for (let dayIndex = 0; dayIndex < (page.days || []).length; dayIndex += 1) {
      const day = page.days[dayIndex];
      const row = [day.date_raw];
      const punches = day.punches || [];
      for (let i = 0; i < maxPunches; i += 2) {
        row.push(punches[i]?.time_hhmm || '', punches[i + 1]?.time_hhmm || '');
      }
      const warning = warningMap.get(`${page.page}-${dayIndex}`);
      rows.push({
        cells: row,
        warning,
        style: warning ? getWarningStyle(warning.reasons) : null,
      });
    }
  }

  return { headers, rows, warnings };
}

function buildPayrollRows(value) {
  const warnings = computePayrollWarnings(value.pages);
  const warningMap = new Map(warnings.map((w) => [w.page, w]));

  const labelOrder = [];
  const labelSet = new Set();
  for (const page of value.pages || []) {
    for (const field of page.fields || []) {
      if (!labelSet.has(field.label)) {
        labelSet.add(field.label);
        labelOrder.push(field.label);
      }
    }
  }

  const headers = ['Pág.', 'Mês', 'Ano', ...labelOrder];
  const rows = [];

  for (const page of value.pages || []) {
    const row = [String(page.page), page.month || '', page.year || ''];
    const fieldMap = new Map((page.fields || []).map((f) => [f.label, f.value]));
    for (const label of labelOrder) {
      row.push(fieldMap.get(label) || '');
    }
    const warning = warningMap.get(page.page);
    rows.push({
      cells: row,
      warning,
      style: warning ? getWarningStyle(warning.reasons) : null,
    });
  }

  return { headers, rows, warnings, labelOrder };
}

function applyRowStyle(sheet, rowNumber, style, numCols) {
  const row = sheet.getRow(rowNumber);
  if (style === 'red') {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED_FILL } };
      if (colNumber === 1) {
        cell.border = {
          left: { style: 'medium', color: { argb: RED_BORDER } },
        };
      }
    });
  } else if (style === 'yellow') {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_FILL } };
    });
  }
  row.commit?.();
  void numCols;
}

export async function buildSpreadsheet(type, value, format) {
  if (format === 'json') {
    const warnings =
      type === 'cartao-ponto'
        ? computeTimeCardWarnings(value.pages)
        : type === 'holerite'
          ? computePayrollWarnings(value.pages)
          : value.summary?.needsReview ? [{ message: 'Documento requer revisão', style: 'yellow' }] : [];
    return {
      contentType: 'application/json',
      filename: `transcricao.${format}`,
      body: JSON.stringify({ value, warnings }, null, 2),
    };
  }

  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Transcrição');

  const built =
    type === 'cartao-ponto'
      ? buildTimeCardRows(value)
      : type === 'holerite'
        ? buildPayrollRows(value)
        : buildGenericRows(value);

  sheet.addRow(built.headers);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  });

  built.rows.forEach((rowData, index) => {
    sheet.addRow(rowData.cells);
    if (rowData.style) {
      applyRowStyle(sheet, index + 2, rowData.style, built.headers.length);
    }
  });

  if (format === 'csv') {
    const csv = await workbook.csv.writeBuffer();
    return {
      contentType: 'text/csv; charset=utf-8',
      filename: 'transcricao.csv',
      body: csv,
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: 'transcricao.xlsx',
    body: buffer,
  };
}

export function getWarningsForValue(type, value) {
  if (type === 'outro') return value.summary?.needsReview ? [{ message: 'Documento requer revisão', style: 'yellow', labels: ['Documento requer revisão'] }] : [];
  if (type === 'cartao-ponto') {
    return computeTimeCardWarnings(value.pages).map((w) => ({
      ...w,
      labels: w.reasons.map(warningReasonLabel),
    }));
  }
  return computePayrollWarnings(value.pages).map((w) => ({
    ...w,
    labels: w.reasons.map(warningReasonLabel),
  }));
}

export { buildTimeCardRows, buildPayrollRows };
