import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, ShadingType, PageBreak,
} from "docx";
import { saveAs } from "file-saver";
import type { ScriptQuestion } from "@/hooks/useResearchScripts";

const BRAND = "1B3A5C";
const LIGHT = "E8F0FE";

function hCell(text: string) {
  return new TableCell({
    shading: { fill: BRAND, type: ShadingType.CLEAR },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF", font: "Arial", size: 20 })] })],
  });
}

function cell(text: string) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, font: "Arial", size: 20 })] })],
  });
}

function finding(
  q: ScriptQuestion,
  resps: Array<{ response_value: string | null; response_numeric: number | null; response_options: string[] | null }>,
): string {
  if (resps.length === 0) return "No responses collected.";
  if (q.type === "scale") {
    const nums = resps.map(r => r.response_numeric ?? 0).filter(n => n > 0);
    const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "N/A";
    return `Average score: ${avg}/10 across ${nums.length} responses.`;
  }
  if (q.type === "open_ended") return `${resps.length} qualitative responses collected.`;
  const freq: Record<string, number> = {};
  resps.forEach(r => {
    const vals = r.response_options?.length ? r.response_options : r.response_value ? [r.response_value] : [];
    vals.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
  });
  const sorted = Object.entries(freq).sort(([, a], [, b]) => b - a);
  if (sorted.length) {
    const [l, c] = sorted[0];
    return `Top response: "${l}" — ${c} of ${resps.length} (${Math.round((c / resps.length) * 100)}%).`;
  }
  return `${resps.length} responses recorded.`;
}

export async function generateDynamicReport(
  script: { name: string; script_type: string; description?: string | null },
  questions: ScriptQuestion[],
  responses: Array<{
    question_order: number;
    response_value: string | null;
    response_options: string[] | null;
    response_numeric: number | null;
    session_id: string;
  }>,
  totalRespondents: number,
) {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const byOrder = new Map<number, typeof responses>();
  responses.forEach(r => {
    if (!byOrder.has(r.question_order)) byOrder.set(r.question_order, []);
    byOrder.get(r.question_order)!.push(r);
  });

  const qSections: (Paragraph | Table)[] = [];
  let curSection = "";

  questions.filter(q => !q.is_internal).forEach(q => {
    if (q.section && q.section !== curSection) {
      curSection = q.section;
      qSections.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
        children: [new TextRun({ text: curSection, bold: true, font: "Arial", size: 28, color: BRAND })],
      }));
    }

    const qr = byOrder.get(q.order) || [];
    const kf = finding(q, qr);

    qSections.push(new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 300, after: 100 },
      children: [new TextRun({ text: `Q${q.order}: ${q.question}`, bold: true, font: "Arial", size: 24, color: BRAND })],
    }));

    qSections.push(new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: "Type: ", bold: true, font: "Arial", size: 20 }),
        new TextRun({ text: q.type.replace(/_/g, " "), font: "Arial", size: 20 }),
        new TextRun({ text: `   |   Responses: ${qr.length} of ${totalRespondents}`, font: "Arial", size: 20 }),
      ],
    }));

    qSections.push(new Paragraph({
      shading: { fill: LIGHT, type: ShadingType.CLEAR },
      spacing: { after: 100 },
      children: [
        new TextRun({ text: "Key Finding: ", bold: true, font: "Arial", size: 20 }),
        new TextRun({ text: kf, font: "Arial", size: 20 }),
      ],
    }));

    if (q.type !== "open_ended" && q.type !== "scale") {
      const freq: Record<string, number> = {};
      (q.options || []).forEach(o => { freq[o] = 0; });
      qr.forEach(r => {
        const vals = r.response_options?.length ? r.response_options : r.response_value ? [r.response_value] : [];
        vals.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
      });
      const sorted = Object.entries(freq).sort(([, a], [, b]) => b - a);
      if (sorted.length) {
        qSections.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
        qSections.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [hCell("Response"), hCell("Count"), hCell("%")] }),
            ...sorted.map(([label, count]) =>
              new TableRow({
                children: [cell(label), cell(String(count)), cell(qr.length ? `${Math.round((count / qr.length) * 100)}%` : "0%")],
              })
            ),
          ],
        }));
      }
    }

    if (q.type === "scale") {
      const freq: Record<number, number> = {};
      qr.forEach(r => { const v = r.response_numeric ?? 0; if (v > 0) freq[v] = (freq[v] || 0) + 1; });
      const rows = Array.from({ length: 10 }, (_, i) => i + 1)
        .filter(n => (freq[n] || 0) > 0)
        .map(n => new TableRow({ children: [cell(String(n)), cell(String(freq[n] || 0)), cell(`${Math.round(((freq[n] || 0) / qr.length) * 100)}%`)] }));
      if (rows.length) {
        qSections.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [new TableRow({ children: [hCell("Rating"), hCell("Count"), hCell("%")] }), ...rows],
        }));
      }
    }

    qSections.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
  });

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200, after: 200 }, children: [new TextRun({ text: script.name, font: "Arial", size: 48, bold: true, color: BRAND })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "Executive Report", font: "Arial", size: 32, color: "666666" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: `Generated ${today} · ${totalRespondents} Respondents · ${questions.filter(q => !q.is_internal).length} Questions`, font: "Arial", size: 22, color: "999999" })] }),
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 200 }, children: [new TextRun({ text: "Executive Summary", bold: true, font: "Arial", size: 36, color: BRAND })] }),
        new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: `This report summarizes findings from the "${script.name}" research script. A total of ${totalRespondents} responses were collected across ${questions.filter(q => !q.is_internal).length} questions. Script type: ${script.script_type || "mixed"}.`, font: "Arial", size: 22 })] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 200 }, children: [new TextRun({ text: "Key Metrics", bold: true, font: "Arial", size: 28, color: BRAND })] }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [hCell("Metric"), hCell("Value")] }),
            new TableRow({ children: [cell("Total Respondents"), cell(String(totalRespondents))] }),
            new TableRow({ children: [cell("Total Questions"), cell(String(questions.filter(q => !q.is_internal).length))] }),
            new TableRow({ children: [cell("Script Type"), cell(script.script_type || "Mixed")] }),
            new TableRow({ children: [cell("Report Date"), cell(today)] }),
          ],
        }),
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 200 }, children: [new TextRun({ text: "Question-by-Question Analysis", bold: true, font: "Arial", size: 36, color: BRAND })] }),
        ...qSections,
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [new TextRun({ text: `PadSplit Research · ${script.name} · Confidential`, font: "Arial", size: 18, color: "999999", italics: true })] }),
      ],
    }],
  });

  const buffer = await Packer.toBlob(doc);
  const safeName = script.name.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-");
  saveAs(buffer, `${safeName}-Executive-Report.docx`);
}
