// src/utils/paymentExperienceReportExport.ts
// Builds a self-contained, dashboard-styled printable HTML report for the
// Payment Experience Script Responses tab and opens it in a new browser
// window. Pure client-side; no backend, no extra dependencies.

import type {
  PEScriptData,
  PEQuestionSummary,
  PEDistributionItem,
} from './paymentExperienceScriptResponses';
import { downloadPaymentExperienceScriptCsv } from './paymentExperienceScriptResponses';

const TYPE_LABELS: Record<string, string> = {
  multi: 'Multiple Choice',
  yesno: 'Yes / No',
  scale: 'Scale',
  open: 'Open Ended',
  compound: 'Compound',
};

const escapeHtml = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
};

const formatDateTime = (d: Date): string => {
  try {
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return d.toISOString();
  }
};

// ── per-type renderers ────────────────────────────────────────────────────

function renderMulti(qs: PEQuestionSummary): string {
  const visible = qs.distribution.filter((d) => d.count > 0);
  if (!visible.length) return `<p class="muted">No responses.</p>`;
  const max = Math.max(1, ...visible.map((d) => d.count));
  const rows = visible
    .map((d) => {
      const w = Math.max(2, Math.round((d.count / max) * 100));
      return `
        <div class="bar-row">
          <div class="bar-row-head">
            <span class="bar-label">${escapeHtml(d.label)}</span>
            <span class="bar-meta">${d.count} · ${d.percentage}%</span>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width:${w}%"></div></div>
        </div>`;
    })
    .join('');
  return `<div class="bar-list">${rows}</div>`;
}

function renderYesNo(qs: PEQuestionSummary): string {
  const yes = qs.distribution.find((d) => d.key === 'yes');
  const no = qs.distribution.find((d) => d.key === 'no');
  return `
    <div class="yn">
      <div class="yn-pill yn-yes">
        <div>
          <div class="yn-label">Yes</div>
          <div class="yn-count">${yes?.count ?? 0}</div>
        </div>
        <div class="yn-pct">${yes?.percentage ?? 0}%</div>
      </div>
      <div class="yn-pill yn-no">
        <div>
          <div class="yn-label">No</div>
          <div class="yn-count">${no?.count ?? 0}</div>
        </div>
        <div class="yn-pct">${no?.percentage ?? 0}%</div>
      </div>
    </div>`;
}

function renderScale(qs: PEQuestionSummary): string {
  const isClarity1to5 =
    qs.question.id === 'move_in_cost_clarity' && qs.min === 1 && qs.max === 5;
  const distribution: PEDistributionItem[] = isClarity1to5
    ? qs.distribution
    : qs.distribution.filter((d) => d.count > 0);
  if (!distribution.length) {
    return `<p class="muted">No responses.</p>`;
  }
  const max = Math.max(1, ...distribution.map((d) => d.count));
  const scale = (c: number) => (c <= 0 ? 0 : Math.sqrt(c) / Math.sqrt(max));
  const CHART_PX = 96;
  const MIN_BAR_PX = 10;
  const modalKey = distribution.reduce<string | null>((acc, d) => {
    const accCount = acc == null ? -1 : (distribution.find((x) => x.key === acc)?.count ?? 0);
    return d.count > accCount ? d.key : acc;
  }, null);
  const bars = distribution
    .map((d) => {
      const isModal = d.count > 0 && d.key === modalKey;
      const px = d.count > 0 ? Math.max(MIN_BAR_PX, Math.round(scale(d.count) * CHART_PX)) : 2;
      return `
        <div class="hist-col">
          <div class="hist-pct">${d.percentage}%</div>
          <div class="hist-bar ${isModal ? 'hist-bar-modal' : ''}" style="height:${px}px"></div>
          <div class="hist-label ${isModal ? 'hist-label-modal' : ''}">${escapeHtml(d.label)}</div>
        </div>`;
    })
    .join('');
  const avg = qs.avg != null ? qs.avg.toFixed(1) : '—';
  return `
    <div class="scale-wrap">
      <div class="scale-avg">
        <span class="scale-avg-num">${avg}</span>
        <span class="scale-avg-meta">avg · range ${qs.min}–${qs.max}</span>
      </div>
      <div class="hist" style="height:${CHART_PX + 28}px">${bars}</div>
      ${
        isClarity1to5
          ? `<div class="scale-caption"><span>Not clear at all</span><span>Crystal clear</span></div>`
          : ''
      }
    </div>`;
}

function renderOpen(qs: PEQuestionSummary): string {
  const samples = qs.samples || [];
  const total = qs.totalSamples ?? qs.count ?? 0;
  if (!samples.length) {
    return `<p class="muted">${total} responses · no verbatims to display.</p>`;
  }
  const items = samples
    .map(
      (s, i) => `
      <div class="verbatim">
        <span class="verbatim-num">#${i + 1}</span>
        <span class="verbatim-text">${escapeHtml(s)}</span>
      </div>`,
    )
    .join('');
  return `
    <p class="muted small">${total} responses · showing up to ${samples.length}</p>
    <div class="verbatims">${items}</div>`;
}

function renderFooter(qs: PEQuestionSummary, total: number): string {
  if (qs.count === 0) return '';
  const t = qs.question.type;
  if (t === 'multi') {
    const top = qs.topLabel != null
      ? ` · Most common: <strong>${escapeHtml(qs.topLabel)}</strong> (${qs.topPct}%)`
      : '';
    return `<div class="card-footer">${qs.uniqueAnswers ?? 0} unique answers${top}</div>`;
  }
  if (t === 'yesno') {
    const pct = total > 0 ? Math.round((qs.count / total) * 100) : 0;
    return `<div class="card-footer">${qs.count} of ${total} responded (${pct}%)</div>`;
  }
  if (t === 'scale') {
    return `<div class="card-footer">${qs.count} responses · range ${qs.min}–${qs.max}</div>`;
  }
  return `<div class="card-footer">${qs.count} written responses</div>`;
}

function renderCompound(qs: PEQuestionSummary): string {
  const subs = qs.subQuestions || [];
  if (subs.length === 0) return `<p class="muted">No responses.</p>`;
  return subs.map((sub) => {
    const subBody = sub.count === 0
      ? `<p class="muted">No responses.</p>`
      : sub.question.type === 'multi'
        ? renderMulti(sub)
        : sub.question.type === 'scale'
          ? renderScale(sub)
          : '';
    return `
      <div class="sub-q">
        <div class="sub-q-head">
          <span class="sub-q-title">${escapeHtml(sub.question.text)}</span>
          <span class="sub-q-count">${sub.count} responses</span>
        </div>
        <div class="sub-q-body">${subBody}</div>
      </div>`;
  }).join('');
}

function renderQuestion(qs: PEQuestionSummary, total: number): string {
  const q = qs.question;
  let body = '';
  if (qs.count === 0) {
    body = `<p class="muted">No responses for this question.</p>`;
  } else if (q.type === 'compound') body = renderCompound(qs);
  else if (q.type === 'multi') body = renderMulti(qs);
  else if (q.type === 'yesno') body = renderYesNo(qs);
  else if (q.type === 'scale') body = renderScale(qs);
  else if (q.type === 'open') body = renderOpen(qs);

  return `
    <section class="q-card">
      <div class="q-head">
        <div class="q-head-left">
          <div class="q-num">Q${q.order}</div>
          <div class="q-title-wrap">
            <div class="q-title">${escapeHtml(q.text)}</div>
            <div class="q-meta">
              <span class="q-badge">${escapeHtml(TYPE_LABELS[q.type] || q.type)}</span>
              ${q.section ? `<span class="q-section">${escapeHtml(q.section)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="q-head-right">
          <div class="q-resp-label">Responses</div>
          <div class="q-resp-count">${qs.count}</div>
        </div>
      </div>
      <div class="q-body">${body}</div>
      ${renderFooter(qs, total)}
    </section>`;
}

// ── full HTML ─────────────────────────────────────────────────────────────

function buildHtml(data: PEScriptData, generatedAt: Date): string {
  const total = data.stats.respondents;
  const questionCount = data.questions.length;
  const responsesCount = data.stats.responseCount;
  const completionRate = `${Math.round(data.stats.completionRate)}%`;
  const avgAnswered = `${data.stats.avgQuestionsAnswered.toFixed(1)} / ${questionCount}`;
  const respondents = data.stats.respondents.toLocaleString();
  const latest = formatDate(data.stats.latestResponseAt);
  const generatedLabel = formatDateTime(generatedAt);

  const questionsHtml = data.questions.map((qs) => renderQuestion(qs, total)).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Payment Experience — Script Responses Report</title>
<style>
  :root {
    --bg: #ffffff;
    --surface: #ffffff;
    --surface-muted: #f8fafc;
    --border: #e2e8f0;
    --border-strong: #cbd5e1;
    --text: #0f172a;
    --text-muted: #475569;
    --text-soft: #64748b;
    --bar-track: #e2e8f0;
    --bar-fill: #475569;
    --amber-bg: #fef3c7;
    --amber-border: #fde68a;
    --amber-text: #92400e;
    --amber-strong: #b45309;
    --shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 14px;
    line-height: 1.45;
    -webkit-font-smoothing: antialiased;
  }
  .page {
    max-width: 960px;
    margin: 0 auto;
    padding: 32px 28px 64px;
  }
  .toolbar {
    position: fixed;
    top: 16px;
    right: 16px;
    display: flex;
    gap: 8px;
    z-index: 50;
  }
  .toolbar button {
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid var(--border-strong);
    background: #ffffff;
    color: var(--text);
    cursor: pointer;
    box-shadow: var(--shadow);
  }
  .toolbar button.primary {
    background: var(--text);
    color: #ffffff;
    border-color: var(--text);
  }
  .toolbar button:hover { filter: brightness(0.97); }

  .header {
    border-bottom: 1px solid var(--border);
    padding-bottom: 20px;
    margin-bottom: 24px;
  }
  .header-eyebrow {
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-soft);
    font-weight: 600;
  }
  .header h1 {
    margin: 6px 0 4px;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--text);
  }
  .header-sub {
    color: var(--text-muted);
    font-size: 13px;
  }
  .header-meta {
    margin-top: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    font-size: 12px;
    color: var(--text-soft);
  }
  .header-meta strong { color: var(--text); font-weight: 600; }

  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }
  .stat-card {
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    box-shadow: var(--shadow);
    padding: 14px 16px;
  }
  .stat-label {
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-soft);
    font-weight: 600;
  }
  .stat-value {
    margin-top: 6px;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
    color: var(--text);
  }

  .section-title {
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-soft);
    font-weight: 600;
    margin: 8px 0 12px;
  }

  .q-card {
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    box-shadow: var(--shadow);
    padding: 18px 20px;
    margin-bottom: 14px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .q-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 12px;
  }
  .q-head-left {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    flex: 1;
    min-width: 0;
  }
  .q-num {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 999px;
    background: var(--surface-muted);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text);
  }
  .q-title-wrap { min-width: 0; }
  .q-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    line-height: 1.4;
  }
  .q-meta {
    margin-top: 6px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .q-badge {
    display: inline-block;
    font-size: 10.5px;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid var(--border-strong);
    color: var(--text-muted);
    background: var(--surface);
  }
  .q-section {
    font-size: 11px;
    color: var(--text-soft);
  }
  .q-head-right { text-align: right; flex-shrink: 0; }
  .q-resp-label { font-size: 11px; color: var(--text-soft); }
  .q-resp-count {
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }

  .q-body { margin-top: 4px; }
  .muted { color: var(--text-soft); font-size: 13px; margin: 0; }
  .small { font-size: 12px; }

  .card-footer {
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
    color: var(--text-soft);
    font-size: 11.5px;
  }
  .card-footer strong { color: var(--text); font-weight: 600; }

  /* Multi bars */
  .bar-list { display: flex; flex-direction: column; gap: 10px; }
  .bar-row { display: flex; flex-direction: column; gap: 4px; }
  .bar-row-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    font-size: 12.5px;
  }
  .bar-label { color: var(--text); }
  .bar-meta {
    color: var(--text-soft);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }
  .bar-track {
    height: 8px;
    width: 100%;
    background: var(--bar-track);
    border-radius: 999px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    background: var(--bar-fill);
    border-radius: 999px;
  }

  /* Yes/No */
  .yn { display: flex; gap: 12px; }
  .yn-pill {
    flex: 1;
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    border: 1px solid;
  }
  .yn-yes {
    background: var(--amber-bg);
    border-color: var(--amber-border);
    color: var(--amber-text);
  }
  .yn-yes .yn-count { color: var(--amber-strong); }
  .yn-no {
    background: var(--surface-muted);
    border-color: var(--border);
    color: var(--text-muted);
  }
  .yn-no .yn-count { color: var(--text); }
  .yn-label {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 600;
  }
  .yn-count {
    margin-top: 2px;
    font-size: 22px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .yn-pct {
    font-size: 13px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  /* Scale histogram */
  .scale-wrap { display: flex; flex-direction: column; gap: 10px; }
  .scale-avg { display: flex; align-items: baseline; gap: 8px; }
  .scale-avg-num {
    font-size: 26px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--text);
  }
  .scale-avg-meta { color: var(--text-soft); font-size: 12.5px; }
  .hist {
    display: flex;
    align-items: flex-end;
    gap: 6px;
  }
  .hist-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: stretch;
    min-width: 0;
  }
  .hist-pct {
    text-align: center;
    font-size: 10.5px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    color: var(--text);
    margin-bottom: 4px;
    line-height: 1;
  }
  .hist-bar {
    background: var(--bar-fill);
    border-radius: 3px;
  }
  .hist-bar-modal { background: var(--amber-strong); }
  .hist-label {
    margin-top: 6px;
    text-align: center;
    font-size: 10.5px;
    color: var(--text-muted);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hist-label-modal { color: var(--amber-strong); }
  .scale-caption {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-soft);
  }

  /* Open-ended */
  .verbatims {
    margin-top: 8px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface-muted);
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .verbatim {
    display: flex;
    gap: 8px;
    font-size: 12px;
    line-height: 1.5;
  }
  .verbatim-num {
    flex-shrink: 0;
    color: var(--text-soft);
    font-variant-numeric: tabular-nums;
    min-width: 28px;
  }
  .verbatim-text { color: var(--text); }

  /* Compound sub-questions */
  .sub-q {
    border-top: 1px solid var(--border);
    padding-top: 14px;
    margin-top: 14px;
  }
  .sub-q:first-child {
    border-top: none;
    padding-top: 0;
    margin-top: 0;
  }
  .sub-q-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 10px;
  }
  .sub-q-title {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text);
  }
  .sub-q-count {
    font-size: 11px;
    color: var(--text-soft);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }


  .footer {
    margin-top: 28px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
    text-align: center;
    color: var(--text-soft);
    font-size: 11px;
  }

  @media print {
    @page { margin: 0.5in; }
    html, body {
      background: #ffffff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body { font-size: 11pt; }
    .page { padding: 0; max-width: none; }
    .no-print { display: none !important; }
    .q-card { box-shadow: none; }
    .stat-card { box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <button class="primary" onclick="window.print()" type="button">Print / Save PDF</button>
    <button onclick="window.close()" type="button">Close</button>
  </div>

  <div class="page">
    <header class="header">
      <div class="header-eyebrow">PadSplit · Payment Experience</div>
      <h1>Payment Experience Survey — Script Responses Report</h1>
      <div class="header-sub">Question-by-question response distribution across all eligible respondents.</div>
      <div class="header-meta">
        <span>Generated <strong>${escapeHtml(generatedLabel)}</strong></span>
        <span>Responses <strong>${responsesCount.toLocaleString()}</strong></span>
        <span>Questions <strong>${questionCount}</strong></span>
      </div>
    </header>

    <div class="section-title">Summary</div>
    <div class="stats">
      <div class="stat-card">
        <div class="stat-label">Completion Rate</div>
        <div class="stat-value">${completionRate}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Questions Answered</div>
        <div class="stat-value">${avgAnswered}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Respondents</div>
        <div class="stat-value">${respondents}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Latest Response</div>
        <div class="stat-value">${latest}</div>
      </div>
    </div>

    <div class="section-title">Questions</div>
    ${questionsHtml}

    <div class="footer">
      PadSplit Payment Experience · Script Responses Report · ${escapeHtml(generatedLabel)}
    </div>
  </div>
</body>
</html>`;
}

export function openPaymentExperienceScriptReport(params: {
  data: PEScriptData;
  generatedAt?: Date;
}): void {
  const { data, generatedAt = new Date() } = params;
  const html = buildHtml(data, generatedAt);

  let w: Window | null = null;
  try {
    w = window.open('', '_blank');
  } catch {
    w = null;
  }

  if (!w) {
    // Popup blocked — fall back to CSV so the click still produces something useful.
    try {
      downloadPaymentExperienceScriptCsv(data);
      // eslint-disable-next-line no-console
      console.warn(
        '[PaymentExperienceReport] Popup blocked — fell back to CSV download. ' +
          'Allow popups to view the formatted report.',
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[PaymentExperienceReport] Popup blocked and CSV fallback failed.', err);
    }
    return;
  }

  try {
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus?.();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[PaymentExperienceReport] Failed to write report HTML.', err);
  }
}
