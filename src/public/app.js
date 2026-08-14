const uploadSection = document.getElementById('upload-section');
const processingSection = document.getElementById('processing-section');
const reviewSection = document.getElementById('review-section');
const uploadForm = document.getElementById('upload-form');
const uploadFeedback = document.getElementById('upload-feedback');
const processingStatus = document.getElementById('processing-status');
const retryBtn = document.getElementById('retry-btn');
const saveBtn = document.getElementById('save-btn');
const saveStatus = document.getElementById('save-status');
const warningsPanel = document.getElementById('warnings-panel');
const editableTable = document.getElementById('editable-table');
const pdfViewer = document.getElementById('pdf-viewer');

let currentId = null;
let currentTipo = null;
let currentValue = null;
let currentWarnings = [];
let pollTimer = null;
let dirty = false;

function show(section) {
  uploadSection.classList.add('hidden');
  processingSection.classList.add('hidden');
  reviewSection.classList.add('hidden');
  section.classList.remove('hidden');
}

function setDirty(value) {
  dirty = value;
  saveStatus.textContent = dirty ? 'Alterações pendentes' : 'Salvo';
}

uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  uploadFeedback.classList.add('hidden');

  const formData = new FormData(uploadForm);
  try {
    const response = await fetch('/api/transcricoes', { method: 'POST', body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Falha no envio');

    currentId = data.id;
    currentTipo = formData.get('tipo');
    show(processingSection);
    processingStatus.textContent = 'Processando documento...';
    retryBtn.classList.add('hidden');
    startPolling();
  } catch (error) {
    uploadFeedback.textContent = error.message;
    uploadFeedback.classList.remove('hidden');
  }
});

retryBtn.addEventListener('click', () => {
  show(uploadSection);
  if (pollTimer) clearInterval(pollTimer);
});

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(pollStatus, 1500);
  pollStatus();
}

async function pollStatus() {
  if (!currentId) return;

  try {
    const response = await fetch(
      `/api/transcricoes/${currentId}/detalhe?_=${Date.now()}`,
      {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      },
    );

    if (!response.ok) {
      throw new Error(`Falha ao consultar status (${response.status})`);
    }

    const data = await response.json();

    if (data.status === 'processando') {
      processingStatus.textContent = 'Processando documento...';
      return;
    }

    clearInterval(pollTimer);

    if (data.status === 'erro') {
      processingStatus.textContent = data.erro || 'Erro ao processar';
      retryBtn.classList.remove('hidden');
      return;
    }

    currentValue = data.value;
    currentWarnings = data.warnings || [];
    currentTipo = data.tipo;
    renderReview();
    show(reviewSection);
  } catch (error) {
    clearInterval(pollTimer);
    processingStatus.textContent = error.message || 'Falha ao consultar processamento';
    retryBtn.classList.remove('hidden');
  }
}


function warningClass(reasons) {
  if (reasons.includes('non_sequential_date') || reasons.includes('non_sequential_month')) {
    return 'warning-red';
  }
  return 'warning-yellow';
}

function renderWarnings() {
  warningsPanel.innerHTML = '';
  for (const warning of currentWarnings) {
    const div = document.createElement('div');
    div.className = `warning-item ${warning.style === 'red' ? 'red' : 'yellow'}`;
    div.textContent = (warning.labels || warning.reasons || []).join(' · ');
    warningsPanel.appendChild(div);
  }
}

function renderTimeCardTable() {
  const pages = currentValue.pages || [];
  let maxPunches = 0;
  pages.forEach((page) => {
    page.days.forEach((day) => {
      maxPunches = Math.max(maxPunches, (day.punches || []).length);
    });
  });

  const headers = ['Data'];
  for (let i = 1; i <= Math.ceil(maxPunches / 2); i += 1) {
    headers.push(`Entrada ${i}`, `Saída ${i}`);
  }

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>`;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  pages.forEach((page, pageIdx) => {
    page.days.forEach((day, dayIdx) => {
      const warning = currentWarnings.find((w) => w.page === page.page && w.dayIndex === dayIdx);
      const tr = document.createElement('tr');
      if (warning) tr.className = warningClass(warning.reasons);

      const dateTd = document.createElement('td');
      const dateInput = document.createElement('input');
      dateInput.value = day.date_raw;
      dateInput.dataset.path = `pages.${pageIdx}.days.${dayIdx}.date_raw`;
      dateInput.addEventListener('input', onCellEdit);
      dateTd.appendChild(dateInput);
      tr.appendChild(dateTd);

      for (let i = 0; i < maxPunches; i += 2) {
        ['IN', 'OUT'].forEach((kind, offset) => {
          const punchIdx = i + offset;
          const td = document.createElement('td');
          const input = document.createElement('input');
          const punch = (day.punches || [])[punchIdx];
          input.value = punch?.time_hhmm || '';
          input.dataset.path = `pages.${pageIdx}.days.${dayIdx}.punches.${punchIdx}`;
          input.dataset.kind = kind;
          input.addEventListener('input', onCellEdit);
          td.appendChild(input);
          tr.appendChild(td);
        });
      }
      tbody.appendChild(tr);
    });
  });

  table.appendChild(tbody);
  editableTable.innerHTML = '';
  editableTable.appendChild(table);
}

function renderPayrollTable() {
  const pages = currentValue.pages || [];
  const labelOrder = [];
  const labelSet = new Set();
  pages.forEach((page) => {
    (page.fields || []).forEach((field) => {
      if (!labelSet.has(field.label)) {
        labelSet.add(field.label);
        labelOrder.push(field.label);
      }
    });
  });

  const headers = ['Pág.', 'Mês', 'Ano', ...labelOrder];
  const table = document.createElement('table');
  table.innerHTML = `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>`;
  const tbody = document.createElement('tbody');

  pages.forEach((page, pageIdx) => {
    const warning = currentWarnings.find((w) => w.page === page.page);
    const tr = document.createElement('tr');
    if (warning) tr.className = warningClass(warning.reasons);

    const fixed = [
      { value: page.page, path: `pages.${pageIdx}.page`, readOnly: true },
      { value: page.month, path: `pages.${pageIdx}.month` },
      { value: page.year, path: `pages.${pageIdx}.year` },
    ];

    fixed.forEach(({ value, path, readOnly }) => {
      const td = document.createElement('td');
      const input = document.createElement('input');
      input.value = value ?? '';
      input.dataset.path = path;
      if (readOnly) input.readOnly = true;
      else input.addEventListener('input', onCellEdit);
      td.appendChild(input);
      tr.appendChild(td);
    });

    const fieldMap = new Map((page.fields || []).map((f, idx) => [f.label, idx]));
    labelOrder.forEach((label) => {
      const td = document.createElement('td');
      const input = document.createElement('input');
      const fieldIdx = fieldMap.get(label);
      if (fieldIdx !== undefined) {
        input.value = page.fields[fieldIdx].value || '';
        input.dataset.path = `pages.${pageIdx}.fields.${fieldIdx}.value`;
      }
      input.addEventListener('input', onCellEdit);
      td.appendChild(input);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  editableTable.innerHTML = '';
  editableTable.appendChild(table);
}

function onCellEdit(event) {
  const { path, kind } = event.target.dataset;
  if (!path) return;
  setPathValue(currentValue, path, event.target.value, kind);
  setDirty(true);
}

function setPathValue(obj, path, value, kind) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    const next = parts[i + 1];
    if (!(key in current)) return;
    if (next === 'punches' && !current[key][Number(parts[i + 2])]) {
      current[key][Number(parts[i + 2])] = { kind, time_raw: value, time_hhmm: value };
    }
    current = current[key];
  }
  const last = parts[parts.length - 1];
  if (parts.includes('punches')) {
    if (!current[last]) current[last] = { kind, time_raw: value, time_hhmm: value };
    current[last].time_raw = value;
    current[last].time_hhmm = value;
    current[last].kind = kind || current[last].kind;
  } else {
    current[last] = value;
  }
}

function renderGenericTable() {
  const pages = currentValue.pages || [];
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Pág.</th><th>Texto extraído</th><th>Tipo</th><th>Confiança</th><th>Revisão</th></tr></thead>';
  const tbody = document.createElement('tbody');

  pages.forEach((page, pageIdx) => {
    const lines = page.generic?.lines || [];
    lines.forEach((line, lineIdx) => {
      const entities = page.generic?.entities?.filter((item) => item.line === line.index) || [];
      const tr = document.createElement('tr');
      if (line.needsReview || entities.some((item) => item.needsReview)) tr.className = 'warning-yellow';

      const pageTd = document.createElement('td');
      pageTd.textContent = String(page.page || pageIdx + 1);
      tr.appendChild(pageTd);

      const textTd = document.createElement('td');
      const input = document.createElement('input');
      input.value = line.text || '';
      input.dataset.path = `pages.${pageIdx}.generic.lines.${lineIdx}.text`;
      input.addEventListener('input', onCellEdit);
      textTd.appendChild(input);
      tr.appendChild(textTd);

      const typeTd = document.createElement('td');
      typeTd.textContent = entities.map((item) => item.type).join(', ') || 'texto';
      tr.appendChild(typeTd);

      const confidenceTd = document.createElement('td');
      confidenceTd.textContent = `${Math.round((line.confidence || 0) * 100)}%`;
      tr.appendChild(confidenceTd);

      const reviewTd = document.createElement('td');
      reviewTd.textContent = line.needsReview ? 'Verificar' : 'OK';
      tr.appendChild(reviewTd);
      tbody.appendChild(tr);
    });
  });

  table.appendChild(tbody);
  editableTable.innerHTML = '';
  const summary = currentValue.summary || {};
  const info = document.createElement('p');
  info.textContent = `Tipo provável: ${summary.classification?.value || 'desconhecido'} · Confiança: ${Math.round((summary.confidence || 0) * 100)}%`;
  editableTable.appendChild(info);
  editableTable.appendChild(table);
}

function hasSpecializedRows() {
  return (currentValue.pages || []).some((page) => {
    if (currentTipo === 'cartao-ponto') {
      return (page.days || []).some((day) => (day.punches || []).length > 0);
    }
    if (currentTipo === 'holerite') {
      return (page.fields || []).length > 0 || (page.bases || []).length > 0;
    }
    return false;
  });
}

function renderReview() {
  pdfViewer.src = `/api/transcricoes/${currentId}/pdf`;
  renderWarnings();
  if (currentTipo === 'cartao-ponto' && hasSpecializedRows()) renderTimeCardTable();
  else if (currentTipo === 'holerite' && hasSpecializedRows()) renderPayrollTable();
  else renderGenericTable();
  setDirty(false);
}

saveBtn.addEventListener('click', async () => {
  const response = await fetch(`/api/transcricoes/${currentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: currentValue }),
  });
  const data = await response.json();
  if (!response.ok) {
    saveStatus.textContent = data.error || 'Erro ao salvar';
    return;
  }
  currentValue = data.value;
  const detail = await fetch(`/api/transcricoes/${currentId}/detalhe`).then((r) => r.json());
  currentWarnings = detail.warnings || [];
  renderReview();
  setDirty(false);
});

document.querySelectorAll('.downloads button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const formato = btn.dataset.format;
    window.location.href = `/api/transcricoes/${currentId}/planilha?formato=${formato}`;
  });
});
