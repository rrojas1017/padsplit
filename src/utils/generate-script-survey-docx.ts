// src/utils/generate-script-survey-docx.ts
// Per-script survey Executive Brief — .docx generator (CR-010 Phase 3).
//
// Twin of `generate-pe-docx.ts` with the same styling. All numbers are
// recomputed deterministically from the records passed in. AI (via
// `generate-script-survey-brief`) writes prose and recommendations only.
//
// Aggregate-only: no member verbatims are included anywhere in the docx.

import {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  Header, Footer, PageNumber,
} from 'docx';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { fetchClustersForQuestion } from '@/utils/openEndedClusterFetch';
import type { ScriptSurveyQuestion, ScriptSurveyRecord } from '@/hooks/useScriptSurveyResponses';
import { summarizeScriptQuestion, type ScriptQuestionSummary } from '@/utils/scriptSurveyAnalytics';
import {
  formatKpiValue,
  SCRIPT_SURVEY_PURPOSE,
  type ScriptKpiConfig,
  type ScriptKpiResult,
} from '@/config/scriptSurveyKpis';

// ── Styling primitives (identical to PE) ────────────────────────────────────

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

// ── AI narrative fetch ───────────────────────────────────────────────────────

interface ScriptSurveyBrief {
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

async function fetchBrief(payload: any): Promise<ScriptSurveyBrief | null> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-script-survey-brief', { body: payload });
    if (error) throw error;
    return data?.executive_brief || null;
  } catch (e) {
    console.error('[generate-script-survey-docx] AI brief failed:', e);
    return null;
  }
}

type Row = { label: string; count: number; pct: number };

function distributionRows(s: ScriptQuestionSummary): Row[] {
  if (s.type === 'scale') return s.buckets.map((b) => ({ label: b.label, count: b.count, pct: b.pct }));
  if (s.type === 'open_ended') return [];
  return s.distribution.map((d) => ({ label: d.label, count: d.count, pct: d.pct }));
}

const slugify = (s: string) =>
  s.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'Survey';

// ── Main export ──────────────────────────────────────────────────────────────

export interface GenerateScriptSurveyDocxParams {
  scriptId: string;
  scriptName: string;
  questions: ScriptSurveyQuestion[];
  sections: string[];
  records: ScriptSurveyRecord[];
  validRecords: ScriptSurveyRecord[];
  eligibleRecords: ScriptSurveyRecord[];
  kpiConfig: ScriptKpiConfig[];
  kpis: ScriptKpiResult[];
}

export async function generateScriptSurveyDocx(params: GenerateScriptSurveyDocxParams) {
  const { scriptId, scriptName, questions, sections, records, validRecords, eligibleRecords, kpiConfig, kpis } = params;
  const todayStr = format(new Date(), 'MMMM d, yyyy');

  // Date range from booking dates ('yyyy-MM-dd' ET strings) on eligible records.
  let minDate: string | null = null;
  let maxDate: string | null = null;
  for (const r of eligibleRecords) {
    const d = (r.booking_date || '').slice(0, 10);
    if (!d) continue;
    if (!minDate || d < minDate) minDate = d;
    if (!maxDate || d > maxDate) maxDate = d;
  }
  const fmtYmd = (d: string) => format(new Date(`${d}T12:00:00`), 'MMM d, yyyy');
  const dateRangeStr = minDate && maxDate ? `${fmtYmd(minDate)} – ${fmtYmd(maxDate)}` : 'All time';

  // Per-question summaries (internal questions already excluded upstream).
  const summaries = new Map<string, ScriptQuestionSummary>();
  for (const q of questions) summaries.set(q.id, summarizeScriptQuestion(q, eligibleRecords));

  // ── Open-ended clusters: same questionId + responses as the dashboard ─────
  const clusterMap = new Map<string, Row[]>();
  await Promise.all(questions.filter((q) => q.type === 'open_ended').map(async (q) => {
    const s = summaries.get(q.id);
    if (!s || s.type !== 'open_ended') return;
    const clusters = await fetchClustersForQuestion(
      `${scriptId}:${q.id}`, q.question, s.allResponses, '[generate-script-survey-docx]',
    );
    if (clusters) clusterMap.set(q.id, clusters);
  }));

  // ── Aggregated AI payload (no verbatims) ──────────────────────────────────
  const aiPayload = {
    surveyName: scriptName,
    surveyPurpose: SCRIPT_SURVEY_PURPOSE[scriptId] || '',
    kpis: kpiConfig.map((k, i) => ({ label: k.label, value: formatKpiValue(k, kpis[i]) })),
    perQuestion: questions.slice(0, 60).map((q) => {
      const s = summaries.get(q.id)!;
      return {
        order: q.order,
        text: q.question,
        section: q.section || '',
        type: q.type,
        count: s.count,
        avg: s.type === 'scale' ? s.avg : null,
        topAnswers: distributionRows(s)
          .filter((d) => d.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        clusters: clusterMap.get(q.id)?.slice(0, 6) || undefined,
      };
    }),
    sections,
    totalRoutedCalls: records.length,
    validConversations: validRecords.length,
    totalRespondents: eligibleRecords.length,
    dateRange: { start: minDate, end: maxDate },
  };

  const brief = await fetchBrief(aiPayload);

  // ── Build doc children ────────────────────────────────────────────────────
  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({
      text: `PadSplit — ${scriptName} Executive Brief`,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated: ${todayStr} · Period: ${dateRangeStr}`, color: '666666', size: 20, font: 'Arial' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
  );

  // Headline (same rendering as PE)
  const headline = brief?.narrative_headline || `${scriptName} snapshot across surveyed members`;
  children.push(new Paragraph({
    children: [new TextRun({ text: stripUUIDs(headline), bold: true, size: 28, font: 'Arial' })],
    spacing: { after: 200 },
  }));

  // ── KPI table (same six tiles as the dashboard) ───────────────────────────
  const metrics = kpiConfig.map((k, i) => ({ label: k.label, value: formatKpiValue(k, kpis[i]) }));
  if (metrics.length > 0) {
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
  }

  // ── Executive Analysis ────────────────────────────────────────────────────
  children.push(new Paragraph({ text: 'Executive Analysis', heading: HeadingLevel.HEADING_1 }));
  if (brief?.executive_narrative) {
    for (const p of brief.executive_narrative.split(/\n\n+/).filter(Boolean)) {
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

  // ── Per-Question Detail, grouped by section ───────────────────────────────
  children.push(new Paragraph({ text: 'Per-Question Detail', heading: HeadingLevel.HEADING_1 }));

  const renderQuestion = (q: ScriptSurveyQuestion) => {
    const s = summaries.get(q.id)!;
    children.push(new Paragraph({
      children: [new TextRun({ text: `Q${q.order}. ${q.question}`, bold: true, size: 22, font: 'Arial' })],
      spacing: { before: 120, after: 40 },
    }));
    const metaParts: string[] = [`n=${s.count}`];
    if (s.type === 'scale' && typeof s.avg === 'number') metaParts.push(`avg=${s.avg.toFixed(2)}`);
    if (q.section) metaParts.push(q.section);
    children.push(new Paragraph({
      children: [new TextRun({ text: metaParts.join(' · '), size: 16, font: 'Arial', color: '888888' })],
      spacing: { after: 60 },
    }));

    if (s.type === 'open_ended') {
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
          children: [new TextRun({ text: `Open-ended responses received: ${s.count}. (Clusters not yet generated.)`, italics: true, size: 18, font: 'Arial', color: '666666' })],
          spacing: { after: 160 },
        }));
      }
      return;
    }

    const rows = s.type === 'scale' ? distributionRows(s) : distributionRows(s).filter((d) => d.count > 0);
    if (s.count === 0 || rows.length === 0) {
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
            cell(`${d.pct.toFixed(1)}%`, 2100, { shading: bg }),
          ] });
        }),
      ],
    }));
    children.push(new Paragraph({ text: '', spacing: { after: 160 } }));
  };

  const rendered = new Set<string>();
  for (const sec of sections) {
    const inSec = questions.filter((q) => q.section === sec);
    if (!inSec.length) continue;
    children.push(new Paragraph({ text: sec, heading: HeadingLevel.HEADING_2 }));
    for (const q of inSec) { renderQuestion(q); rendered.add(q.id); }
  }
  const unsectioned = questions.filter((q) => !rendered.has(q.id));
  if (unsectioned.length) {
    if (sections.length) children.push(new Paragraph({ text: 'Other questions', heading: HeadingLevel.HEADING_2 }));
    for (const q of unsectioned) renderQuestion(q);
  }

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
        `Aggregates derived from ${records.length.toLocaleString()} routed ${scriptName} survey calls, ` +
        `of which ${validRecords.length.toLocaleString()} were valid conversations and ` +
        `${eligibleRecords.length.toLocaleString()} had at least one answered question (eligible respondents). ` +
        `Answers come from the agent's typed survey form plus answers extracted by AI from the call recording; ` +
        `when both exist for a question, the typed form answer wins. All metrics recomputed deterministically ` +
        `from those answers. Open-ended themes clustered by AI (Gemini); narrative prose written by Gemini 2.5 Pro ` +
        `grounded in the aggregates above. No individual member verbatims are included.`,
      size: 18, font: 'Arial', color: '555555',
    })],
    spacing: { after: 200 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({
      text: `PadSplit Research Analytics Platform · ${scriptName} · ${brief?.generated_at ? 'AI-generated brief' : 'Data-driven report'}`,
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
          children: [new TextRun({ text: `PadSplit ${scriptName} — Confidential`, color: '999999', size: 16, font: 'Arial' })],
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
  link.download = `PadSplit-${slugify(scriptName)}-Brief-${format(new Date(), 'yyyy-MM-dd')}.docx`;
  link.click();
  URL.revokeObjectURL(url);
}
