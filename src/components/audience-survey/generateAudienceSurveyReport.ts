import {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  Header, Footer, PageNumber,
} from 'docx';
import type { AudienceSurveyRecord } from '@/hooks/useAudienceSurveyResponses';
import type { AggResult } from '@/hooks/useAudienceSurveyResponses';

interface QuestionReport {
  number: number;
  label: string;
  type: 'multi' | 'yesno';
  data: AggResult[];
  boolData?: { yes: number; no: number; total: number; pct: number };
}

interface ReportMeta {
  totalRecords: number;
  avgAnswered: number;
  completionRate: number;
}

function generateKeyFinding(label: string, data: AggResult[], boolData?: { yes: number; no: number; total: number; pct: number }, type?: string): string {
  if (type === 'yesno' && boolData) {
    if (boolData.total === 0) return 'No responses collected for this question.';
    if (boolData.pct >= 70) return `Strong majority: ${boolData.pct}% said Yes (${boolData.yes} of ${boolData.total}).`;
    if (boolData.pct <= 30) return `Most respondents said No: only ${boolData.pct}% said Yes.`;
    return `Split response: ${boolData.pct}% Yes vs ${100 - boolData.pct}% No.`;
  }

  if (data.length === 0) return 'No responses collected for this question.';
  const top = data[0];
  if (top.pct > 60) return `${top.label} is the dominant response at ${top.pct}%, significantly ahead of other options.`;
  if (data.length >= 2 && data[0].pct - data[1].pct < 10) {
    return `${data[0].label} (${data[0].pct}%) and ${data[1].label} (${data[1].pct}%) are nearly tied as top responses.`;
  }
  const total = data.reduce((s, d) => s + d.count, 0);
  return `${top.label} leads at ${top.pct}% of responses (${top.count} of ${total}).`;
}

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

function makeHeaderCell(text: string, width: number): TableCell {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: 'E8F0FE', type: ShadingType.CLEAR },
    margins: cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20, font: 'Arial' })] })],
  });
}

function makeCell(text: string, width: number): TableCell {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    margins: cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text, size: 20, font: 'Arial' })] })],
  });
}

export async function generateAudienceSurveyReport(
  records: AudienceSurveyRecord[],
  questions: QuestionReport[],
  meta: ReportMeta,
) {
  const topFindings = questions
    .map(q => ({ label: q.label, finding: generateKeyFinding(q.label, q.data, q.boolData, q.type) }))
    .filter(f => !f.finding.includes('No responses'));

  const questionSections = questions.flatMap(q => {
    const children: (Paragraph | Table)[] = [
      new Paragraph({
        text: `Q${q.number}: ${q.label}`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `Type: ${q.type === 'multi' ? 'Multiple Select' : 'Yes/No'}`, italics: true, color: '888888', size: 18, font: 'Arial' }),
        ],
        spacing: { after: 100 },
      }),
    ];

    if (q.type === 'yesno' && q.boolData) {
      children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [4680, 2340, 2340],
        rows: [
          new TableRow({ children: [makeHeaderCell('Answer', 4680), makeHeaderCell('Count', 2340), makeHeaderCell('%', 2340)] }),
          new TableRow({ children: [makeCell('Yes', 4680), makeCell(String(q.boolData.yes), 2340), makeCell(`${q.boolData.pct}%`, 2340)] }),
          new TableRow({ children: [makeCell('No', 4680), makeCell(String(q.boolData.no), 2340), makeCell(`${q.boolData.total > 0 ? 100 - q.boolData.pct : 0}%`, 2340)] }),
        ],
      }));
    } else if (q.data.length > 0) {
      children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [5000, 2180, 2180],
        rows: [
          new TableRow({ children: [makeHeaderCell('Answer', 5000), makeHeaderCell('Count', 2180), makeHeaderCell('% of Responses', 2180)] }),
          ...q.data.map(item => new TableRow({
            children: [makeCell(item.label, 5000), makeCell(String(item.count), 2180), makeCell(`${item.pct}%`, 2180)],
          })),
        ],
      }));
    }

    const finding = generateKeyFinding(q.label, q.data, q.boolData, q.type);
    children.push(new Paragraph({
      children: [
        new TextRun({ text: 'Key Finding: ', bold: true, size: 20, font: 'Arial' }),
        new TextRun({ text: finding, size: 20, font: 'Arial' }),
      ],
      spacing: { before: 100, after: 200 },
    }));

    return children;
  });

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, font: 'Arial' }, paragraph: { spacing: { before: 240, after: 240 } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, font: 'Arial' }, paragraph: { spacing: { before: 180, after: 120 } } },
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
            children: [new TextRun({ text: 'PadSplit Audience Survey Report', color: '999999', size: 16, font: 'Arial' })],
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
      children: [
        new Paragraph({
          text: 'Audience Survey \u2014 Executive Research Report',
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Generated: ${new Date().toLocaleDateString()}`, color: '666666', size: 20, font: 'Arial' }),
            new TextRun({ text: `  \u00B7  ${meta.totalRecords} Responses`, color: '666666', size: 20, font: 'Arial' }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),

        new Paragraph({ text: 'Executive Summary', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({
          children: [new TextRun({
            text: `This report summarizes findings from ${meta.totalRecords} responses collected through the PadSplit Audience Survey. The survey contains 13 questions covering platform usage, ad awareness, engagement triggers, barriers to adoption, and testimonial interest. On average, respondents answered ${meta.avgAnswered} of 13 questions (${meta.completionRate}% completion rate).`,
            size: 22, font: 'Arial',
          })],
          spacing: { after: 200 },
        }),

        new Paragraph({ text: 'Key Metrics', heading: HeadingLevel.HEADING_1 }),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [4680, 4680],
          rows: [
            new TableRow({ children: [makeHeaderCell('Metric', 4680), makeHeaderCell('Value', 4680)] }),
            new TableRow({ children: [makeCell('Total Responses', 4680), makeCell(String(meta.totalRecords), 4680)] }),
            new TableRow({ children: [makeCell('Avg Completion Rate', 4680), makeCell(`${meta.completionRate}%`, 4680)] }),
            new TableRow({ children: [makeCell('Avg Questions Answered', 4680), makeCell(`${meta.avgAnswered} / 13`, 4680)] }),
          ],
        }),
        new Paragraph({ text: '', spacing: { after: 200 } }),

        new Paragraph({ text: 'Question-by-Question Analysis', heading: HeadingLevel.HEADING_1 }),
        ...questionSections,

        new Paragraph({ text: 'Data Source', heading: HeadingLevel.HEADING_1, spacing: { before: 400 } }),
        new Paragraph({
          children: [new TextRun({ text: 'PadSplit Research Analytics Platform \u00B7 Audience Survey Campaign', size: 20, font: 'Arial', color: '666666' })],
          spacing: { after: 100 },
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `audience-survey-report-${new Date().toISOString().split('T')[0]}.docx`;
  link.click();
  URL.revokeObjectURL(url);
}
