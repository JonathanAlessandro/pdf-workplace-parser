import { parseDateRaw } from './extractors/parseUtils.js';

export function computeTimeCardWarnings(pages) {
  const warnings = [];
  let lastValidDate = null;

  for (const page of pages || []) {
    for (let dayIndex = 0; dayIndex < (page.days || []).length; dayIndex++) {
      const day = page.days[dayIndex];
      const reasons = [];
      const punches = day.punches || [];

      if (punches.length % 2 !== 0) {
        reasons.push('odd_punches');
      }

      const parsed = parseDateRaw(day.date_raw);
      if (parsed?.valid) {
        const current = new Date(Number(parsed.year), Number(parsed.month) - 1, Number(parsed.day));
        if (lastValidDate) {
          const expected = new Date(lastValidDate);
          expected.setDate(expected.getDate() + 1);
          if (
            current.getFullYear() !== expected.getFullYear() ||
            current.getMonth() !== expected.getMonth() ||
            current.getDate() !== expected.getDate()
          ) {
            reasons.push('non_sequential_date');
          }
        }
        lastValidDate = current;
      }

      const hasUncertainty = [day.date_raw, ...punches.flatMap((p) => [p.time_raw, p.time_hhmm])].some(
        (v) => String(v).includes('?'),
      );
      if (hasUncertainty) {
        reasons.push('uncertainty');
      }

      if (reasons.length) {
        warnings.push({
          page: page.page,
          dayIndex,
          date_raw: day.date_raw,
          reasons,
          style: reasons.includes('non_sequential_date') ? 'red' : 'yellow',
        });
      }
    }
  }

  return warnings;
}

function parseCompetence(page) {
  const month = String(page.month || '');
  const year = String(page.year || '');
  if (!month || !year || month.includes('?') || year.includes('?')) return null;
  const m = Number(month);
  const y = Number(year);
  if (Number.isNaN(m) || Number.isNaN(y) || m < 1 || m > 12) return null;
  return { month: m, year: y };
}

export function computePayrollWarnings(pages) {
  const warnings = [];
  let lastValidCompetence = null;

  for (const page of pages || []) {
    const reasons = [];
    const hasData =
      (page.fields || []).length > 0 ||
      (page.bases || []).length > 0 ||
      page.year ||
      page.month;

    if (!hasData) {
      reasons.push('empty_page');
    }

    const competence = parseCompetence(page);
    if (competence) {
      if (lastValidCompetence) {
        let expectedMonth = lastValidCompetence.month + 1;
        let expectedYear = lastValidCompetence.year;
        if (expectedMonth > 12) {
          expectedMonth = 1;
          expectedYear += 1;
        }
        if (competence.month !== expectedMonth || competence.year !== expectedYear) {
          reasons.push('non_sequential_month');
        }
      }
      lastValidCompetence = competence;
    }

    const hasUncertainty = [
      page.year,
      page.month,
      ...(page.fields || []).flatMap((f) => [f.code, f.label, f.reference, f.value]),
      ...(page.bases || []).flatMap((b) => [b.label, b.value]),
    ].some((v) => String(v).includes('?'));

    if (hasUncertainty) {
      reasons.push('uncertainty');
    }

    if (reasons.length) {
      warnings.push({
        page: page.page,
        reasons,
        style: reasons.includes('non_sequential_month') ? 'red' : 'yellow',
      });
    }
  }

  return warnings;
}

export function getWarningStyle(reasons) {
  if (reasons.includes('non_sequential_date') || reasons.includes('non_sequential_month')) {
    return 'red';
  }
  return 'yellow';
}

export function warningReasonLabel(reason) {
  const labels = {
    odd_punches: 'Número ímpar de batidas',
    non_sequential_date: 'Data não sequencial',
    non_sequential_month: 'Mês não sequencial',
    empty_page: 'Página vazia',
    uncertainty: 'Caracteres incertos (?)',
  };
  return labels[reason] || reason;
}
