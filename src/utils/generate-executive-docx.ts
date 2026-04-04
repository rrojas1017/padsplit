import {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  Header, Footer, PageNumber,
} from 'docx';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

// ── Types ───────────────────────────────────────────────────────────────────────

interface ReportData {
  executive_summary?: any;
  reason_code_distribution?: any[];
  issue_clusters?: any[];
  top_actions?: any[];
  host_accountability_flags?: any[];
  emerging_patterns?: any[];
}

interface ExecutiveBrief {
  narrative_headline?: string;
  executive_narrative?: string;
  trend_analysis?: string;
  risk_flags?: string[];
  key_quotes?: string[];
  recommendations_with_ownership?: Array<{
    recommendation: string;
    owner: string;
    urgency: string;
    rationale: string;
  }>;
  generated_at?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

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

function fmtPct(value: any): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return String(value);
  return `${Math.round(n)}%`;
}

// ── Fetch AI brief (same as PDF version) ────────────────────────────────────────

async function fetchExecutiveBrief(insightId: string): Promise<ExecutiveBrief | null> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-executive-brief', {
      body: { insight_id: insightId },
    });
    if (error) throw error;
    return data?.executive_brief || null;
  } catch {
    return null;
  }
}

// ── Main export ─────────────────────────────────────────────────────────────────

export async function generateMoveOutDocx(
  reportData: ReportData,
  reportDate?: string,
  insightId?: string,
  totalRecordsOverride?: number,
) {
  const dateStr = reportDate
    ? format(new Date(reportDate), 'MMMM d, yyyy')
    : format(new Date(), 'MMMM d, yyyy');

  // Try AI brief
  let brief: ExecutiveBrief | null = null;
  if (insightId) {
    brief = await fetchExecutiveBrief(insightId);
  }

  const es = reportData.executive_summary || {};
  const headline = brief?.narrative_headline || es.headline?.split(/(?<=[.!?])\s+/)[0] || 'Move-Out Research Executive Brief';

  // ── Build sections ──────────────────────────────────────────────────────────

  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(
    new Paragraph({
      text: 'PadSplit — Move-Out Research Executive Brief',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Generated: ${dateStr}`, color: '666666', size: 20, font: 'Arial' }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
  );

  // Headline
  children.push(new Paragraph({
    children: [new TextRun({ text: stripUUIDs(headline), bold: true, size: 28, font: 'Arial' })],
    spacing: { after: 200 },
  }));

  // KPI row — use DB total_records_analyzed (accurate) instead of AI-generated total_cases
  const totalCases = totalRecordsOverride || es.total_cases || 0;

  // Recompute percentages from reason_code_distribution against real total
  const reasons = reportData.reason_code_distribution || [];
  const hostRelatedCount = reasons
    .filter((r: any) => /host|property|maintenance|mold|pest/i.test(r.reason_group || r.name || ''))
    .reduce((sum: number, r: any) => sum + (r.count || r.value || 0), 0);
  const paymentCount = reasons
    .filter((r: any) => /payment|financial|afford/i.test(r.reason_group || r.name || ''))
    .reduce((sum: number, r: any) => sum + (r.count || r.value || 0), 0);

  const pctOf = (n: number) => totalCases > 0 ? `${Math.round((n / totalCases) * 100)}%` : '—';

  const metrics = [
    { label: 'Total Cases', value: totalCases.toString() },
    { label: 'Addressable', value: fmtPct(es.addressable_pct) },
    { label: 'High Regret', value: fmtPct(es.high_regret_pct) },
    { label: 'Host Related', value: pctOf(hostRelatedCount) },
    { label: 'Payment', value: pctOf(paymentCount) },
  ];
  const kpiColWidth = Math.floor(9360 / metrics.length);
  children.push(new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: metrics.map(() => kpiColWidth),
    rows: [
      new TableRow({ children: metrics.map(m => new TableCell({
        borders: cellBorders,
        width: { size: kpiColWidth, type: WidthType.DXA },
        shading: { fill: KPI_BG, type: ShadingType.CLEAR },
        margins: cellMargins,
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: m.value, bold: true, size: 24, font: 'Arial' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: m.label, size: 14, font: 'Arial', color: '666666' })] }),
        ],
      })) }),
    ],
  }));
  children.push(new Paragraph({ text: '', spacing: { after: 200 } }));

  // Executive Analysis (AI or key_findings fallback)
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
    const rawFindings = es.key_findings || '';
    const findingsText = typeof rawFindings === 'string' ? rawFindings : (Array.isArray(rawFindings) ? rawFindings.join(' ') : '');
    if (findingsText) {
      children.push(new Paragraph({
        children: [new TextRun({ text: stripUUIDs(findingsText), size: 22, font: 'Arial' })],
        spacing: { after: 200 },
      }));
    }
  }

  // Risk Flags
  if (brief?.risk_flags && brief.risk_flags.length > 0) {
    children.push(new Paragraph({ text: 'Risk Flags', heading: HeadingLevel.HEADING_1 }));
    for (const flag of brief.risk_flags) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `• ${stripUUIDs(flag)}`, size: 20, font: 'Arial', color: 'CC0000' })],
        spacing: { after: 60 },
      }));
    }
  }

  // Key Quotes
  if (brief?.key_quotes && brief.key_quotes.length > 0) {
    children.push(new Paragraph({ text: 'Member Voices', heading: HeadingLevel.HEADING_1 }));
    for (const quote of brief.key_quotes) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `"${stripUUIDs(quote)}"`, italics: true, size: 20, font: 'Arial', color: '4A5568' })],
        spacing: { after: 80 },
      }));
    }
  }

  // Reason Code Distribution (reuse reasons from above)
  if (reasons.length > 0) {
    children.push(new Paragraph({ text: 'Reason Code Distribution', heading: HeadingLevel.HEADING_1 }));
    children.push(new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [3500, 1200, 1200, 3460],
      rows: [
        new TableRow({ children: [
          headerCell('Reason Code', 3500),
          headerCell('Volume', 1200),
          headerCell('%', 1200),
          headerCell('Description', 3460),
        ] }),
        ...reasons.slice(0, 15).map((r: any, i: number) => {
          const bg = i % 2 === 1 ? LIGHT_BG : undefined;
          return new TableRow({ children: [
            cell(stripUUIDs(r.reason_group || r.name || ''), 3500, { shading: bg }),
            cell(String(r.count || r.value || ''), 1200, { shading: bg }),
            cell(fmtPct(r.percentage), 1200, { shading: bg }),
            cell(stripUUIDs((r.description || '').substring(0, 80)), 3460, { shading: bg }),
          ] });
        }),
      ],
    }));
    children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
  }

  // Recommendations with Ownership
  if (brief?.recommendations_with_ownership && brief.recommendations_with_ownership.length > 0) {
    children.push(new Paragraph({ text: 'Recommendations & Ownership', heading: HeadingLevel.HEADING_1 }));
    children.push(new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [1200, 3500, 1500, 3160],
      rows: [
        new TableRow({ children: [
          headerCell('Priority', 1200),
          headerCell('Recommendation', 3500),
          headerCell('Owner', 1500),
          headerCell('Rationale', 3160),
        ] }),
        ...brief.recommendations_with_ownership.map((r, i) => {
          const bg = i % 2 === 1 ? LIGHT_BG : undefined;
          return new TableRow({ children: [
            cell(r.urgency || '—', 1200, { shading: bg }),
            cell(stripUUIDs(r.recommendation || '').substring(0, 120), 3500, { shading: bg }),
            cell(r.owner || '—', 1500, { shading: bg }),
            cell(stripUUIDs(r.rationale || '').substring(0, 100), 3160, { shading: bg }),
          ] });
        }),
      ],
    }));
    children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
  }

  // Critical Issue Clusters
  const clusters = (reportData.issue_clusters || []).filter((c: any) => {
    const name = (c.cluster_name || '').toUpperCase();
    return name.includes('P0') || name.includes('P1');
  });
  if (clusters.length > 0) {
    children.push(new Paragraph({ text: 'Critical Issue Clusters', heading: HeadingLevel.HEADING_1 }));
    for (const c of clusters) {
      children.push(new Paragraph({
        children: [new TextRun({ text: stripUUIDs(c.cluster_name || ''), bold: true, size: 22, font: 'Arial' })],
        spacing: { before: 100 },
      }));
      if (c.description) {
        children.push(new Paragraph({
          children: [new TextRun({ text: stripUUIDs(c.description.substring(0, 300)), size: 20, font: 'Arial' })],
          spacing: { after: 60 },
        }));
      }
      if (c.recommended_action) {
        const action = typeof c.recommended_action === 'string' ? c.recommended_action : c.recommended_action[0];
        children.push(new Paragraph({
          children: [
            new TextRun({ text: 'Action: ', bold: true, size: 20, font: 'Arial', color: '3182CE' }),
            new TextRun({ text: stripUUIDs(action.substring(0, 200)), italics: true, size: 20, font: 'Arial', color: '3182CE' }),
          ],
          spacing: { after: 120 },
        }));
      }
    }
  }

  // Priority Actions
  const p0Actions = (reportData.top_actions || []).filter((a: any) =>
    (a.priority || '').toUpperCase().includes('P0')
  );
  if (p0Actions.length > 0) {
    children.push(new Paragraph({ text: 'Priority Actions', heading: HeadingLevel.HEADING_1 }));
    children.push(new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [1400, 6560, 1400],
      rows: [
        new TableRow({ children: [
          headerCell('Priority', 1400),
          headerCell('Action', 6560),
          headerCell('Quick Win', 1400),
        ] }),
        ...p0Actions.map((a: any, i: number) => {
          const bg = i % 2 === 1 ? LIGHT_BG : undefined;
          return new TableRow({ children: [
            cell(a.priority || '', 1400, { shading: bg }),
            cell(stripUUIDs((a.action || '').substring(0, 150)), 6560, { shading: bg }),
            cell(a.quick_win ? '✓' : '—', 1400, { shading: bg }),
          ] });
        }),
      ],
    }));
    children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
  }

  // Host Accountability Flags
  const criticalFlags = (reportData.host_accountability_flags || []).filter((f: any) =>
    (f.severity || '').toLowerCase().includes('p0') || (f.severity || '').toLowerCase().includes('critical')
  );
  if (criticalFlags.length > 0) {
    children.push(new Paragraph({ text: 'Critical Host Accountability Flags', heading: HeadingLevel.HEADING_1 }));
    for (const f of criticalFlags) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: f.severity || 'Critical', bold: true, size: 20, font: 'Arial', color: 'CC0000' }),
          new TextRun({ text: ` — ${stripUUIDs(f.flag || '')}`, size: 20, font: 'Arial' }),
        ],
        spacing: { after: 100 },
      }));
    }
  }

  // Data source footer
  children.push(new Paragraph({
    text: '',
    spacing: { before: 400 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({
      text: `PadSplit Research Analytics Platform · Move-Out Survey · ${brief?.generated_at ? 'AI-generated brief' : 'Data-driven report'}`,
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
        default: new Header({
          children: [new Paragraph({
            children: [new TextRun({ text: 'PadSplit Move-Out Research Report — Confidential', color: '999999', size: 16, font: 'Arial' })],
            alignment: AlignmentType.RIGHT,
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            children: [new TextRun({ text: 'Page ', size: 16, font: 'Arial' }), new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial' })],
            alignment: AlignmentType.CENTER,
          })],
        }),
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `PadSplit-Executive-Brief-${format(new Date(), 'yyyy-MM-dd')}.docx`;
  link.click();
  URL.revokeObjectURL(url);
}
