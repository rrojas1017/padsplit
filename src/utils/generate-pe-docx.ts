// src/utils/generate-pe-docx.ts
// Payment Experience Executive Brief — .docx generator.
//
// Mirrors `generate-executive-docx.ts` (Move-Out) but tailored for the PE data
// model. All numbers are recomputed deterministically from the live records
// passed in. AI (Gemini 2.5 Pro via `generate-pe-executive-brief`) writes
// prose paragraphs and recommendations only — never numbers.
//
// Aggregate-only: no member verbatims are included anywhere in the docx.

import {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  Header, Footer, PageNumber,
} from 'docx';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { PaymentExperienceRecord, PaymentKPIs } from '@/hooks/usePaymentExperienceResponses';
import {
  derivePaymentExperienceScriptData,
  type PEQuestionSummary,
} from '@/utils/paymentExperienceScriptResponses';

// ── Styling primitives ───────────────────────────────────────────────────────

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

const NAVY_HEX = '1A365D';
const LIGHT_BG = 'F7FAFC';
const KPI_BG = 'E8F0FE';

function headerCell(text: string, width: number): TableCell {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: NAVY_HEX, type: ShadingType.CLEAR },
    margins: cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 18, font: 'Arial', color: 'FFFFFF' })] })],
  });
}

function cell(text: string, width: number, opts?: { bold?: boolean; color?: string; shading?: string }): TableCell {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: opts?.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text, size: 18, font: 'Arial', bold: opts?.bold, color: opts?.color })] })],
  });
}

function stripUUIDs(text: string): string {
  if (!text) return '';
  return text
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ── Hash helper (matches usePEOpenEndedClusters) ─────────────────────────────

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Cluster cache lookup ────────────────────────────────────────────────────
//
// Reads cached AI clusters for a given open-ended question from
// `payment_experience_open_ended_cluster_cache`. Returns aggregate buckets
// only (label, count, %). Returns null if no cache hit.

async function fetchClustersForQuestion(
  questionId: string,
  responses: string[],
): Promise<Array<{ label: string; count: number; pct: number }> | null> {
  if (responses.length < 8) return null; // matches MIN_RESPONSES_FOR_AI
  try {
    const hash = await sha256Hex(JSON.stringify(responses));
    const { data, error } = await supabase
      .from('payment_experience_open_ended_cluster_cache')
      .select('clusters')
      .eq('question_id', questionId)
      .eq('response_hash', hash)
      .maybeSingle();
    if (error || !data) return null;
    const raw = (data as any).clusters as Array<{ label?: string; responseIndices?: number[] }>;
    if (!Array.isArray(raw)) return null;
    const total = responses.length;
    return raw
      .map((c) => ({
        label: c.label || 'Unlabeled',
        count: Array.isArray(c.responseIndices) ? c.responseIndices.length : 0,
      }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count)
      .map((c) => ({ ...c, pct: total > 0 ? (c.count / total) * 100 : 0 }));
  } catch {
    return null;
  }
}

// ── AI narrative fetch ───────────────────────────────────────────────────────

interface PEBrief {
  narrative_headline?: string;
  executive_narrative?: string;
  risk_flags?: string[];
  recommended_actions?: Array<{
    recommendation: string;
    owner: string;
    urgency: string;
    rationale: string;
  }>;
  generated_at?: string;
}

async function fetchPEBrief(payload: any): Promise<PEBrief | null> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-pe-executive-brief', {
      body: payload,
    });
    if (error) throw error;
    return data?.executive_brief || null;
  } catch (e) {
    console.error('[generate-pe-docx] AI brief failed:', e);
    return null;
  }
}

// ── KPI formatting ───────────────────────────────────────────────────────────

const fmtPct = (v: number | null) => (v == null ? '—' : `${Math.round(v)}%`);
const fmtScore = (v: number | null, max: number) => (v == null ? '—' : `${v.toFixed(1)}/${max}`);

// ── Main export ──────────────────────────────────────────────────────────────

export async function generatePEDocx(
  records: PaymentExperienceRecord[],
  eligibleRecords: PaymentExperienceRecord[],
  kpis: PaymentKPIs,
  topFrictionThemes: Array<{ key: string; label: string; count: number; share: number }>,
  autopayBarriers: Array<{ key: string; label: string; count: number; share: number }>,
) {
  const todayStr = format(new Date(), 'MMMM d, yyyy');

  // Derive per-question summaries from script responses (all 16 questions).
  const scriptData = derivePaymentExperienceScriptData(eligibleRecords, records.length);

  // Compute date range from booking dates on eligible records.
  let minDate: string | null = null;
  let maxDate: string | null = null;
  for (const r of eligibleRecords) {
    if (!r.booking_date) continue;
    if (!minDate || r.booking_date < minDate) minDate = r.booking_date;
    if (!maxDate || r.booking_date > maxDate) maxDate = r.booking_date;
  }
  const dateRangeStr = minDate && maxDate
    ? `${format(new Date(minDate), 'MMM d, yyyy')} – ${format(new Date(maxDate), 'MMM d, yyyy')}`
    : 'All time';

  // ── Resolve open-ended clusters from cache (parallel) ──────────────────────
  const openSummaries = scriptData.questions.filter((q) => q.question.type === 'open');
  const clusterMap = new Map<string, Array<{ label: string; count: number; pct: number }>>();
  await Promise.all(openSummaries.map(async (q) => {
    const responses = (q.allResponses || []).filter(Boolean);
    const clusters = await fetchClustersForQuestion(q.question.id, responses);
    if (clusters) clusterMap.set(q.question.id, clusters);
  }));

  // ── Build aggregated AI payload (no verbatims) ────────────────────────────
  const aiPayload = {
    kpis: {
      membersSurveyed: eligibleRecords.length,
      literacyAvg: kpis.literacy.value,
      autopayEnrolledPct: kpis.autopayEnrolled.value,
      moveInClarityAvg: kpis.moveInClarity.value,
      hardshipAwarePct: kpis.hardshipAware.value,
      payCycleMisalignmentPct: kpis.payCycleMisalignment.value,
    },
    perQuestion: scriptData.questions.map((qs) => ({
      order: qs.question.order,
      text: qs.question.text,
      type: qs.question.type,
      count: qs.count,
      avg: typeof qs.avg === 'number' ? qs.avg : null,
      topAnswers: qs.distribution.slice(0, 5).map((d) => ({
        label: d.label, count: d.count, pct: d.percentage,
      })),
      clusters: clusterMap.get(qs.question.id)?.slice(0, 6) || undefined,
    })),
    frictionThemes: topFrictionThemes.map((t) => ({
      label: t.label, count: t.count, pct: t.share * 100,
    })),
    autopayBarriers: autopayBarriers.map((b) => ({
      label: b.label, count: b.count, pct: b.share * 100,
    })),
    dateRange: { start: minDate, end: maxDate },
    totalRespondents: eligibleRecords.length,
  };

  const brief = await fetchPEBrief(aiPayload);

  // ── Build doc children ────────────────────────────────────────────────────

  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(
    new Paragraph({
      text: 'PadSplit — Payment Experience Executive Brief',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated: ${todayStr} · Period: ${dateRangeStr}`, color: '666666', size: 20, font: 'Arial' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
  );

  // Headline
  const headline = brief?.narrative_headline || 'Payment Experience snapshot across surveyed members';
  children.push(new Paragraph({
    children: [new TextRun({ text: stripUUIDs(headline), bold: true, size: 28, font: 'Arial' })],
    spacing: { after: 200 },
  }));

  // ── KPI table (recomputed from raw data) ──────────────────────────────────
  const metrics = [
    { label: 'Members Surveyed', value: eligibleRecords.length.toLocaleString() },
    { label: 'Avg Literacy', value: fmtScore(kpis.literacy.value, 100) },
    { label: 'Auto-pay Enrolled', value: fmtPct(kpis.autopayEnrolled.value) },
    { label: 'Move-in Clarity', value: fmtScore(kpis.moveInClarity.value, 5) },
    { label: 'Hardship-Aware', value: fmtPct(kpis.hardshipAware.value) },
    { label: 'Pay-cycle Misalign', value: fmtPct(kpis.payCycleMisalignment.value) },
  ];
  const kpiColWidth = Math.floor(9360 / metrics.length);
  children.push(new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: metrics.map(() => kpiColWidth),
    rows: [
      new TableRow({ children: metrics.map((m) => new TableCell({
        borders: cellBorders,
        width: { size: kpiColWidth, type: WidthType.DXA },
        shading: { fill: KPI_BG, type: ShadingType.CLEAR },
        margins: cellMargins,
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: m.value, bold: true, size: 22, font: 'Arial' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: m.label, size: 14, font: 'Arial', color: '666666' })] }),
        ],
      })) }),
    ],
  }));
  children.push(new Paragraph({ text: '', spacing: { after: 200 } }));

  // ── Executive Analysis (AI prose) ─────────────────────────────────────────
  children.push(new Paragraph({ text: 'Executive Analysis', heading: HeadingLevel.HEADING_1 }));
  if (brief?.executive_narrative) {
    const paras = brief.executive_narrative.split(/\n\n+/).filter(Boolean);
    for (const p of paras) {
      children.push(new Paragraph({
        children: [new TextRun({ text: stripUUIDs(p.replace(/\*\*/g, '')), size: 22, font: 'Arial' })],
        spacing: { after: 120 },
      }));
    }
  } else {
    children.push(new Paragraph({
      children: [new TextRun({
        text: 'AI narrative unavailable. Refer to KPI table and per-question detail below for the data-driven view.',
        italics: true, size: 22, font: 'Arial', color: '666666',
      })],
      spacing: { after: 200 },
    }));
  }

  // ── Risk flags ────────────────────────────────────────────────────────────
  if (brief?.risk_flags?.length) {
    children.push(new Paragraph({ text: 'Risk Flags', heading: HeadingLevel.HEADING_1 }));
    for (const flag of brief.risk_flags) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `• ${stripUUIDs(flag)}`, size: 20, font: 'Arial', color: 'CC0000' })],
        spacing: { after: 60 },
      }));
    }
  }

  // ── Top Friction Themes ───────────────────────────────────────────────────
  if (topFrictionThemes.length > 0) {
    children.push(new Paragraph({ text: 'Top Friction Themes', heading: HeadingLevel.HEADING_1 }));
    children.push(new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [5160, 2100, 2100],
      rows: [
        new TableRow({ children: [headerCell('Theme', 5160), headerCell('Count', 2100), headerCell('Share', 2100)] }),
        ...topFrictionThemes.map((t, i) => {
          const bg = i % 2 === 1 ? LIGHT_BG : undefined;
          return new TableRow({ children: [
            cell(t.label, 5160, { shading: bg }),
            cell(String(t.count), 2100, { shading: bg }),
            cell(`${(t.share * 100).toFixed(1)}%`, 2100, { shading: bg }),
          ] });
        }),
      ],
    }));
    children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
  }

  // ── Auto-pay Barriers ─────────────────────────────────────────────────────
  if (autopayBarriers.length > 0) {
    children.push(new Paragraph({ text: 'Auto-pay Barriers (among not-enrolled)', heading: HeadingLevel.HEADING_1 }));
    children.push(new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [5160, 2100, 2100],
      rows: [
        new TableRow({ children: [headerCell('Barrier', 5160), headerCell('Count', 2100), headerCell('Share', 2100)] }),
        ...autopayBarriers.map((b, i) => {
          const bg = i % 2 === 1 ? LIGHT_BG : undefined;
          return new TableRow({ children: [
            cell(b.label, 5160, { shading: bg }),
            cell(String(b.count), 2100, { shading: bg }),
            cell(`${(b.share * 100).toFixed(1)}%`, 2100, { shading: bg }),
          ] });
        }),
      ],
    }));
    children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
  }

  // ── Per-Question Detail (every script question) ───────────────────────────
  children.push(new Paragraph({ text: 'Per-Question Detail', heading: HeadingLevel.HEADING_1 }));

  const renderQuestion = (qs: PEQuestionSummary, indent = false) => {
    const q = qs.question;
    const titleSize = indent ? 20 : 22;
    children.push(new Paragraph({
      children: [new TextRun({
        text: `${indent ? '  └ ' : `Q${q.order}. `}${q.text}`,
        bold: true, size: titleSize, font: 'Arial',
      })],
      spacing: { before: 120, after: 40 },
    }));
    const metaParts: string[] = [`n=${qs.count}`];
    if (typeof qs.avg === 'number' && q.type === 'scale') metaParts.push(`avg=${qs.avg.toFixed(2)}`);
    if (q.section) metaParts.push(q.section);
    children.push(new Paragraph({
      children: [new TextRun({ text: metaParts.join(' · '), size: 16, font: 'Arial', color: '888888' })],
      spacing: { after: 60 },
    }));

    if (q.type === 'compound') {
      for (const sub of qs.subQuestions || []) renderQuestion(sub, true);
      return;
    }

    if (q.type === 'open') {
      const clusters = clusterMap.get(q.id);
      if (clusters && clusters.length > 0) {
        children.push(new Paragraph({
          children: [new TextRun({ text: 'AI clusters (aggregate, no verbatims):', italics: true, size: 18, font: 'Arial', color: '555555' })],
          spacing: { after: 40 },
        }));
        children.push(new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [5160, 2100, 2100],
          rows: [
            new TableRow({ children: [headerCell('Cluster', 5160), headerCell('Count', 2100), headerCell('% of responses', 2100)] }),
            ...clusters.map((c, i) => {
              const bg = i % 2 === 1 ? LIGHT_BG : undefined;
              return new TableRow({ children: [
                cell(c.label, 5160, { shading: bg }),
                cell(String(c.count), 2100, { shading: bg }),
                cell(`${c.pct.toFixed(1)}%`, 2100, { shading: bg }),
              ] });
            }),
          ],
        }));
        children.push(new Paragraph({ text: '', spacing: { after: 160 } }));
      } else {
        children.push(new Paragraph({
          children: [new TextRun({ text: `Open-ended responses received: ${qs.count}. (Clusters not yet generated.)`, italics: true, size: 18, font: 'Arial', color: '666666' })],
          spacing: { after: 160 },
        }));
      }
      return;
    }

    // multi / yesno / scale → distribution table
    const rows = qs.distribution.filter((d) => d.count > 0);
    if (rows.length === 0) {
      children.push(new Paragraph({
        children: [new TextRun({ text: '(no responses)', italics: true, size: 18, font: 'Arial', color: '888888' })],
        spacing: { after: 160 },
      }));
      return;
    }
    children.push(new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [5160, 2100, 2100],
      rows: [
        new TableRow({ children: [headerCell('Answer', 5160), headerCell('Count', 2100), headerCell('%', 2100)] }),
        ...rows.slice(0, 25).map((d, i) => {
          const bg = i % 2 === 1 ? LIGHT_BG : undefined;
          return new TableRow({ children: [
            cell(d.label, 5160, { shading: bg }),
            cell(String(d.count), 2100, { shading: bg }),
            cell(`${d.percentage.toFixed(1)}%`, 2100, { shading: bg }),
          ] });
        }),
      ],
    }));
    children.push(new Paragraph({ text: '', spacing: { after: 160 } }));
  };

  for (const qs of scriptData.questions) renderQuestion(qs);

  // ── Recommended Actions ───────────────────────────────────────────────────
  if (brief?.recommended_actions?.length) {
    children.push(new Paragraph({ text: 'Recommended Actions', heading: HeadingLevel.HEADING_1 }));
    children.push(new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [1200, 3800, 1500, 2860],
      rows: [
        new TableRow({ children: [
          headerCell('Priority', 1200),
          headerCell('Recommendation', 3800),
          headerCell('Owner', 1500),
          headerCell('Rationale', 2860),
        ] }),
        ...brief.recommended_actions.slice(0, 8).map((r, i) => {
          const bg = i % 2 === 1 ? LIGHT_BG : undefined;
          return new TableRow({ children: [
            cell(r.urgency || '—', 1200, { shading: bg }),
            cell(stripUUIDs(r.recommendation || '').slice(0, 200), 3800, { shading: bg }),
            cell(r.owner || '—', 1500, { shading: bg }),
            cell(stripUUIDs(r.rationale || '').slice(0, 160), 2860, { shading: bg }),
          ] });
        }),
      ],
    }));
    children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
  }

  // ── Methodology + footer ──────────────────────────────────────────────────
  children.push(new Paragraph({ text: 'Methodology', heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({
    children: [new TextRun({
      text:
        `Aggregates derived from ${records.length.toLocaleString()} routed Payment Experience survey calls, ` +
        `of which ${eligibleRecords.length.toLocaleString()} were analytics-eligible (valid conversation, ` +
        `≥120s duration, ≥3 required extraction fields). All metrics recomputed deterministically from raw ` +
        `extractions. Open-ended themes clustered by AI (Gemini); narrative prose written by Gemini 2.5 Pro ` +
        `grounded in the aggregates above. No individual member verbatims are included.`,
      size: 18, font: 'Arial', color: '555555',
    })],
    spacing: { after: 200 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({
      text: `PadSplit Research Analytics Platform · Payment Experience · ${brief?.generated_at ? 'AI-generated brief' : 'Data-driven report'}`,
      size: 18, font: 'Arial', color: '999999',
    })],
  }));

  // ── Build document ────────────────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, font: 'Arial' }, paragraph: { spacing: { before: 300, after: 200 } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, font: 'Arial' }, paragraph: { spacing: { before: 200, after: 120 } } },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({ children: [new Paragraph({
          children: [new TextRun({ text: 'PadSplit Payment Experience — Confidential', color: '999999', size: 16, font: 'Arial' })],
          alignment: AlignmentType.RIGHT,
        })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({
          children: [new TextRun({ text: 'Page ', size: 16, font: 'Arial' }), new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial' })],
          alignment: AlignmentType.CENTER,
        })] }),
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `PadSplit-Payment-Experience-Brief-${format(new Date(), 'yyyy-MM-dd')}.docx`;
  link.click();
  URL.revokeObjectURL(url);
}
