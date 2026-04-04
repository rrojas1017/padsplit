import {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  Header, Footer, PageNumber, PageBreak,
} from 'docx';
import { format } from 'date-fns';

// ── Types ───────────────────────────────────────────────────────────────────────

interface BookingInsightData {
  total_calls_analyzed: number;
  pain_points: any[];
  objection_patterns: any[];
  sentiment_distribution: { positive: number; neutral: number; negative: number };
  market_breakdown: Record<string, any>;
  ai_recommendations: any[];
  customer_journeys?: any[];
  created_at: string;
  analysis_period: string;
  date_range_start: string;
  date_range_end: string;
}

interface NonBookingInsightData {
  total_calls_analyzed: number;
  rejection_reasons: any[];
  missed_opportunities: any[];
  sentiment_distribution: any;
  objection_patterns: any[];
  recovery_recommendations: any[];
  agent_breakdown: any;
  created_at: string;
  analysis_period: string;
  date_range_start: string;
  date_range_end: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

const NAVY_HEX = '1A365D';
const LIGHT_BG = 'F7FAFC';
const KPI_BG = 'E8F0FE';
const ACCENT_BG = 'FFF8E1';

function headerCell(text: string, width: number): TableCell {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: NAVY_HEX, type: ShadingType.CLEAR },
    margins: cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 18, font: 'Arial', color: 'FFFFFF' })] })],
  });
}

function dataCell(text: string, width: number, opts?: { bold?: boolean; color?: string; shading?: string }): TableCell {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: opts?.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text, size: 18, font: 'Arial', bold: opts?.bold, color: opts?.color })] })],
  });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1 });
}

function subHeading(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2 });
}

function bodyText(text: string, opts?: { italic?: boolean; color?: string }): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 20, font: 'Arial', italics: opts?.italic, color: opts?.color })],
    spacing: { after: 100 },
  });
}

function bulletItem(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: `• ${text}`, size: 20, font: 'Arial' })],
    spacing: { after: 60 },
  });
}

function kpiTable(metrics: { label: string; value: string }[]): Table {
  const colWidth = Math.floor(9360 / metrics.length);
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: metrics.map(() => colWidth),
    rows: [
      new TableRow({
        children: metrics.map(m => new TableCell({
          borders: cellBorders,
          width: { size: colWidth, type: WidthType.DXA },
          shading: { fill: KPI_BG, type: ShadingType.CLEAR },
          margins: cellMargins,
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: m.value, bold: true, size: 24, font: 'Arial' })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: m.label, size: 14, font: 'Arial', color: '666666' })] }),
          ],
        })),
      }),
    ],
  });
}

// ── Main export ─────────────────────────────────────────────────────────────────

export async function generateCommunicationInsightsDocx(
  bookingInsight: BookingInsightData | null,
  nonBookingInsight: NonBookingInsightData | null,
) {
  const dateStr = format(new Date(), 'MMMM d, yyyy');
  const children: (Paragraph | Table)[] = [];

  // ── Title ──────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      text: 'PadSplit — Communication Insights Executive Summary',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated: ${dateStr}`, color: '666666', size: 20, font: 'Arial' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
  );

  // ── SECTION 1: Booking Insights ──────────────────────────────────────────
  if (bookingInsight) {
    children.push(sectionHeading('Booking Call Insights'));

    const period = `${format(new Date(bookingInsight.date_range_start), 'MMM d, yyyy')} – ${format(new Date(bookingInsight.date_range_end), 'MMM d, yyyy')}`;
    children.push(bodyText(`Analysis Period: ${period} · ${bookingInsight.total_calls_analyzed} calls analyzed`, { color: '666666' }));

    // KPI row
    const sent = bookingInsight.sentiment_distribution || { positive: 0, neutral: 0, negative: 0 };
    const total = sent.positive + sent.neutral + sent.negative || 1;
    const pctPos = Math.round((sent.positive / total) * 100);
    const pctNeg = Math.round((sent.negative / total) * 100);

    children.push(kpiTable([
      { label: 'Total Calls', value: String(bookingInsight.total_calls_analyzed) },
      { label: 'Positive Sentiment', value: `${pctPos}%` },
      { label: 'Negative Sentiment', value: `${pctNeg}%` },
      { label: 'Pain Points', value: String(bookingInsight.pain_points?.length || 0) },
    ]));
    children.push(new Paragraph({ text: '', spacing: { after: 200 } }));

    // Pain Points
    if (bookingInsight.pain_points?.length > 0) {
      children.push(subHeading('Top Pain Points'));
      children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3500, 1200, 4660],
        rows: [
          new TableRow({ children: [
            headerCell('Pain Point', 3500),
            headerCell('Mentions', 1200),
            headerCell('Details', 4660),
          ] }),
          ...bookingInsight.pain_points.slice(0, 10).map((p: any, i: number) => {
            const bg = i % 2 === 1 ? LIGHT_BG : undefined;
            const name = typeof p === 'string' ? p : (p.pain_point || p.name || p.issue || '');
            const count = p.count || p.frequency || p.mentions || '';
            const detail = p.detail || p.description || p.example || '';
            return new TableRow({ children: [
              dataCell(name, 3500, { shading: bg }),
              dataCell(String(count), 1200, { shading: bg }),
              dataCell(String(detail).substring(0, 100), 4660, { shading: bg }),
            ] });
          }),
        ],
      }));
      children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
    }

    // Objection Patterns
    if (bookingInsight.objection_patterns?.length > 0) {
      children.push(subHeading('Objection Patterns'));
      for (const o of bookingInsight.objection_patterns.slice(0, 8)) {
        const objName = typeof o === 'string' ? o : (o.objection || o.pattern || o.name || '');
        const freq = o.percentage || o.frequency || '';
        children.push(bulletItem(`${objName}${freq ? ` (${freq}%)` : ''}`));
      }
      children.push(new Paragraph({ text: '', spacing: { after: 100 } }));
    }

    // Market Breakdown
    if (bookingInsight.market_breakdown && Object.keys(bookingInsight.market_breakdown).length > 0) {
      children.push(subHeading('Market Breakdown'));
      const markets = Object.entries(bookingInsight.market_breakdown)
        .sort((a: any, b: any) => (b[1]?.call_count || 0) - (a[1]?.call_count || 0))
        .slice(0, 10);
      for (const [market, data] of markets) {
        const d = data as any;
        children.push(bulletItem(`${market}: ${d.call_count || 0} calls${d.top_pain_point ? ` — Top issue: ${d.top_pain_point}` : ''}`));
      }
      children.push(new Paragraph({ text: '', spacing: { after: 100 } }));
    }

    // Recommendations
    if (bookingInsight.ai_recommendations?.length > 0) {
      children.push(subHeading('AI Recommendations'));
      for (const r of bookingInsight.ai_recommendations.slice(0, 8)) {
        const rec = typeof r === 'string' ? r : (r.recommendation || r.action || r.text || '');
        children.push(bulletItem(rec));
      }
      children.push(new Paragraph({ text: '', spacing: { after: 100 } }));
    }
  }

  // ── SECTION 2: Non-Booking Insights ───────────────────────────────────────
  if (nonBookingInsight) {
    // Page break before non-booking section if booking section exists
    if (bookingInsight) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    children.push(sectionHeading('Non-Booking Call Insights'));

    const period = `${format(new Date(nonBookingInsight.date_range_start), 'MMM d, yyyy')} – ${format(new Date(nonBookingInsight.date_range_end), 'MMM d, yyyy')}`;
    children.push(bodyText(`Analysis Period: ${period} · ${nonBookingInsight.total_calls_analyzed} calls analyzed`, { color: '666666' }));

    // KPI row
    const nbSent = nonBookingInsight.sentiment_distribution || {};
    children.push(kpiTable([
      { label: 'Total Non-Booking Calls', value: String(nonBookingInsight.total_calls_analyzed) },
      { label: 'Rejection Reasons', value: String(nonBookingInsight.rejection_reasons?.length || 0) },
      { label: 'Missed Opportunities', value: String(nonBookingInsight.missed_opportunities?.length || 0) },
    ]));
    children.push(new Paragraph({ text: '', spacing: { after: 200 } }));

    // Rejection Reasons
    if (nonBookingInsight.rejection_reasons?.length > 0) {
      children.push(subHeading('Top Rejection Reasons'));
      children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [4000, 1500, 1500, 2360],
        rows: [
          new TableRow({ children: [
            headerCell('Reason', 4000),
            headerCell('Count', 1500),
            headerCell('%', 1500),
            headerCell('Insight', 2360),
          ] }),
          ...nonBookingInsight.rejection_reasons.slice(0, 12).map((r: any, i: number) => {
            const bg = i % 2 === 1 ? LIGHT_BG : undefined;
            return new TableRow({ children: [
              dataCell(r.reason || '', 4000, { shading: bg }),
              dataCell(String(r.count || 0), 1500, { shading: bg }),
              dataCell(`${r.percentage || 0}%`, 1500, { shading: bg }),
              dataCell((r.insight || '').substring(0, 60), 2360, { shading: bg }),
            ] });
          }),
        ],
      }));
      children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
    }

    // Missed Opportunities
    if (nonBookingInsight.missed_opportunities?.length > 0) {
      children.push(subHeading('Missed Opportunities'));
      for (const m of nonBookingInsight.missed_opportunities.slice(0, 8)) {
        const desc = typeof m === 'string' ? m : (m.description || m.opportunity || m.text || '');
        children.push(bulletItem(desc));
      }
      children.push(new Paragraph({ text: '', spacing: { after: 100 } }));
    }

    // Objection Patterns
    if (nonBookingInsight.objection_patterns?.length > 0) {
      children.push(subHeading('Objection Patterns'));
      for (const o of nonBookingInsight.objection_patterns.slice(0, 8)) {
        const objName = o.objection || o.pattern || '';
        const suggestion = o.suggested_response || '';
        children.push(bulletItem(`${objName}${suggestion ? ` → ${suggestion}` : ''}`));
      }
      children.push(new Paragraph({ text: '', spacing: { after: 100 } }));
    }

    // Recovery Recommendations
    if (nonBookingInsight.recovery_recommendations?.length > 0) {
      children.push(subHeading('Recovery Recommendations'));
      for (const r of nonBookingInsight.recovery_recommendations.slice(0, 8)) {
        const rec = typeof r === 'string' ? r : (r.recommendation || r.action || r.text || '');
        children.push(bulletItem(rec));
      }
    }
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  children.push(new Paragraph({ text: '', spacing: { before: 400 } }));
  children.push(new Paragraph({
    children: [new TextRun({
      text: `PadSplit Research Analytics Platform · Communication Insights · Auto-generated`,
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
            children: [new TextRun({ text: 'PadSplit Communication Insights Report — Confidential', color: '999999', size: 16, font: 'Arial' })],
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
  link.download = `PadSplit-Communication-Insights-${format(new Date(), 'yyyy-MM-dd')}.docx`;
  link.click();
  URL.revokeObjectURL(url);
}
