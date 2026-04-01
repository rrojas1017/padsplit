import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { TrendPoint } from '@/hooks/useResearchTrends';

const NAVY = '#1a365d';
const RED = '#e53e3e';
const AMBER = '#dd6b20';
const BLUE = '#3182ce';
const GRAY = '#718096';
const LIGHT_GRAY = '#f7fafc';

interface ReportData {
  executive_summary?: any;
  reason_code_distribution?: any[];
  issue_clusters?: any[];
  top_actions?: any[];
  host_accountability_flags?: any[];
}

export async function generateExecutivePDF(
  reportData: ReportData,
  trends: TrendPoint[] = [],
  reportDate?: string
) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const dateStr = reportDate ? format(new Date(reportDate), 'MMMM d, yyyy') : format(new Date(), 'MMMM d, yyyy');
  let y = margin;

  // --- HELPER FUNCTIONS ---
  function addFooter(pageNum: number) {
    doc.setFontSize(7);
    doc.setTextColor(GRAY);
    doc.text(`PadSplit Research Insights — Confidential — Generated ${dateStr}`, margin, 287);
    doc.text(`Page ${pageNum}`, pageWidth - margin, 287, { align: 'right' });
  }

  function checkPageBreak(needed: number, pageNum: { current: number }) {
    if (y + needed > 270) {
      addFooter(pageNum.current);
      doc.addPage();
      pageNum.current++;
      y = margin;
    }
  }

  function sectionHeader(text: string) {
    doc.setFontSize(12);
    doc.setTextColor(NAVY);
    doc.setFont('helvetica', 'bold');
    doc.text(text, margin, y);
    y += 2;
    doc.setDrawColor(NAVY);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;
  }

  const pageNum = { current: 1 };
  const es = reportData.executive_summary || {};

  // ═══════════════════════════════════════════
  // PAGE 1: Cover & Executive Summary
  // ═══════════════════════════════════════════
  // Header
  doc.setFontSize(18);
  doc.setTextColor(NAVY);
  doc.setFont('helvetica', 'bold');
  doc.text('PadSplit', margin, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(GRAY);
  doc.text('Move-Out Research Executive Brief', margin + 30, y);
  doc.text(dateStr, pageWidth - margin, y, { align: 'right' });
  y += 4;
  doc.setDrawColor(NAVY);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + contentWidth, y);
  y += 10;

  // Headline
  const rawHeadline = es.headline || '';
  const headlineSentence = rawHeadline.split(/(?<=[.!?])\s+/)[0] || 'Research Insights Summary';
  doc.setFontSize(13);
  doc.setTextColor(NAVY);
  doc.setFont('helvetica', 'bold');
  const headlineLines = doc.splitTextToSize(headlineSentence, contentWidth);
  doc.text(headlineLines, margin, y);
  y += headlineLines.length * 6 + 6;

  // Key Metrics Row
  const metrics = [
    { label: 'Total Cases', value: es.total_cases?.toString() || 'N/A' },
    { label: 'Addressable', value: es.addressable_pct || 'N/A' },
    { label: 'High Regret', value: es.high_regret_pct || 'N/A' },
    { label: 'Host Related', value: es.host_related_pct || 'N/A' },
    { label: 'Payment', value: es.payment_related_pct || 'N/A' },
  ];

  const boxWidth = contentWidth / metrics.length;
  doc.setFillColor(LIGHT_GRAY);
  doc.roundedRect(margin, y - 2, contentWidth, 18, 2, 2, 'F');

  metrics.forEach((m, i) => {
    const x = margin + i * boxWidth + boxWidth / 2;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(NAVY);
    doc.text(m.value, x, y + 6, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(GRAY);
    doc.text(m.label, x, y + 12, { align: 'center' });
  });
  y += 24;

  // Key Findings
  const rawFindings = es.key_findings || '';
  const findingsText = typeof rawFindings === 'string' ? rawFindings : (Array.isArray(rawFindings) ? rawFindings.join(' ') : '');
  if (findingsText) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(NAVY);
    doc.text('KEY FINDINGS', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#2d3748');
    const findingsLines = doc.splitTextToSize(findingsText, contentWidth);
    doc.text(findingsLines, margin, y);
    y += findingsLines.length * 4 + 6;
  }

  addFooter(pageNum.current);

  // ═══════════════════════════════════════════
  // PAGE 2: Reason Code Breakdown & Trends
  // ═══════════════════════════════════════════
  doc.addPage();
  pageNum.current++;
  y = margin;

  sectionHeader('Reason Code Distribution');

  const reasons = reportData.reason_code_distribution || [];
  if (reasons.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Reason Code', 'Volume', 'Percentage', 'Description']],
      body: reasons.map((r: any) => [
        r.reason_group || '',
        r.count || '',
        r.percentage || '',
        (r.description || '').substring(0, 80) + ((r.description || '').length > 80 ? '…' : ''),
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: NAVY, textColor: '#ffffff', fontStyle: 'bold' },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Trend table
  if (trends.length >= 2) {
    checkPageBreak(40, pageNum);
    sectionHeader('Week-over-Week Trend');

    const trendArrow = (current: string, previous: string) => {
      if (current === 'N/A' || previous === 'N/A') return '→';
      return current > previous ? '↑' : current < previous ? '↓' : '→';
    };

    autoTable(doc, {
      startY: y,
      head: [['Report Date', 'Total Cases', 'Addressable %', 'Host Related %', 'Payment %']],
      body: trends.slice(0, 4).map((t, i) => {
        const prev = trends[i + 1];
        return [
          format(new Date(t.date), 'MMM d, yyyy'),
          `${t.totalCases}${prev ? ` ${t.totalCases > prev.totalCases ? '↑' : t.totalCases < prev.totalCases ? '↓' : '→'}` : ''}`,
          t.addressablePct,
          t.hostRelatedPct,
          t.paymentRelatedPct,
        ];
      }),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: NAVY, textColor: '#ffffff', fontStyle: 'bold' },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // Trend summary text
    if (trends.length >= 2) {
      const delta = trends[0].totalCases - trends[1].totalCases;
      const pctChange = trends[1].totalCases > 0 ? Math.round((delta / trends[1].totalCases) * 100) : 0;
      doc.setFontSize(8);
      doc.setTextColor('#2d3748');
      doc.setFont('helvetica', 'italic');
      const summary = delta >= 0
        ? `Total cases increased by ${pctChange}% from the previous report (${trends[1].totalCases} → ${trends[0].totalCases}).`
        : `Total cases decreased by ${Math.abs(pctChange)}% from the previous report (${trends[1].totalCases} → ${trends[0].totalCases}).`;
      doc.text(summary, margin, y);
      y += 8;
    }
  }

  addFooter(pageNum.current);

  // ═══════════════════════════════════════════
  // PAGE 3: Top Issues & Actions
  // ═══════════════════════════════════════════
  doc.addPage();
  pageNum.current++;
  y = margin;

  const clusters = (reportData.issue_clusters || []).filter((c: any) => {
    const name = (c.cluster_name || '').toUpperCase();
    return name.includes('P0') || name.includes('P1');
  });

  if (clusters.length > 0) {
    sectionHeader('Critical Issue Clusters');
    clusters.forEach((c: any) => {
      checkPageBreak(30, pageNum);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(NAVY);
      doc.text(c.cluster_name || '', margin, y);
      y += 5;

      if (c.description) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor('#2d3748');
        const descLines = doc.splitTextToSize(c.description.substring(0, 200), contentWidth);
        doc.text(descLines, margin, y);
        y += descLines.length * 4 + 2;
      }

      if (c.recommended_action) {
        const action = typeof c.recommended_action === 'string' ? c.recommended_action : c.recommended_action[0];
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(BLUE);
        const actionLines = doc.splitTextToSize(`Action: ${action.substring(0, 150)}`, contentWidth);
        doc.text(actionLines, margin, y);
        y += actionLines.length * 4 + 6;
      }
    });
  }

  // Top Actions
  const p0Actions = (reportData.top_actions || []).filter((a: any) =>
    (a.priority || '').toUpperCase().includes('P0')
  );

  if (p0Actions.length > 0) {
    checkPageBreak(30, pageNum);
    sectionHeader('Priority Actions');

    autoTable(doc, {
      startY: y,
      head: [['Priority', 'Action', 'Quick Win']],
      body: p0Actions.map((a: any) => [
        a.priority || '',
        (a.action || '').substring(0, 120) + ((a.action || '').length > 120 ? '…' : ''),
        a.quick_win ? '✓' : '—',
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: NAVY, textColor: '#ffffff', fontStyle: 'bold' },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: 20 },
        2: { cellWidth: 20, halign: 'center' },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  addFooter(pageNum.current);

  // ═══════════════════════════════════════════
  // PAGE 4: Host Accountability (only if P0 flags)
  // ═══════════════════════════════════════════
  const criticalFlags = (reportData.host_accountability_flags || []).filter((f: any) =>
    (f.severity || '').toLowerCase().includes('p0') || (f.severity || '').toLowerCase().includes('critical')
  );

  if (criticalFlags.length > 0) {
    doc.addPage();
    pageNum.current++;
    y = margin;

    sectionHeader('Critical Host Accountability Flags');

    criticalFlags.forEach((f: any) => {
      checkPageBreak(20, pageNum);
      // Severity badge
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(RED);
      doc.text(f.severity || 'Critical', margin, y);
      y += 4;
      // Flag text
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor('#2d3748');
      const flagLines = doc.splitTextToSize(f.flag || '', contentWidth);
      doc.text(flagLines, margin, y);
      y += flagLines.length * 4 + 6;
    });

    addFooter(pageNum.current);
  }

  // Save
  const filename = `PadSplit-Executive-Brief-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
}
