import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';

// ── Constants ──────────────────────────────────────────────────────────────────

const COMPANY = { name: 'Appendify, LLC', tagline: 'AI Processing & Analytics Services' };
const CLIENT = { name: 'PadSplit, Inc.' };

const SERVICE_TYPES = {
  stt_transcription: 'Transcribed',
  ai_analysis: 'AI Analysis',
  ai_qa_scoring: 'QA Scored',
  ai_coaching: 'AI Coaching',
  tts_coaching: 'TTS Coaching',
  tts_qa_coaching: 'TTS QA Coaching',
} as const;

type ServiceKey = keyof typeof SERVICE_TYPES;
const SERVICE_KEYS = Object.keys(SERVICE_TYPES) as ServiceKey[];

// ── Helpers ────────────────────────────────────────────────────────────────────

function drawConfidential(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180);
  doc.text('CONFIDENTIAL', pw - 14, 12, { align: 'right' });
  doc.setTextColor(0);
}

function drawPageFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setDrawColor(200);
  doc.line(14, ph - 16, pw - 14, ph - 16);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text(`Appendify, LLC  |  Records Processing Detail  |  Page ${pageNum} of ${totalPages}`, pw / 2, ph - 10, { align: 'center' });
  doc.setTextColor(0);
}

function needsNewPage(doc: jsPDF, y: number, margin = 30): boolean {
  return y > doc.internal.pageSize.getHeight() - margin;
}

// ── Data types ─────────────────────────────────────────────────────────────────

interface BookingRow {
  id: string;
  booking_date: string;
  member_name: string;
  market_city: string | null;
  market_state: string | null;
  call_duration_seconds: number | null;
  status: string;
  communication_method: string | null;
  agent: { name: string } | null;
}

interface ProcessedRecord extends BookingRow {
  services: Set<string>;
  classification: 'Voice' | 'Text' | '—';
}

// ── Data fetching ──────────────────────────────────────────────────────────────

async function fetchProcessingData(periodStart: string, periodEnd: string) {
  // Bookings in period (non-research)
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, booking_date, member_name, market_city, market_state, call_duration_seconds, status, communication_method, agent:agents(name)')
    .gte('booking_date', periodStart)
    .lte('booking_date', periodEnd)
    .neq('record_type', 'research')
    .order('booking_date', { ascending: true })
    .limit(5000);

  // API costs grouped by booking
  const { data: costs } = await supabase
    .from('api_costs')
    .select('booking_id, service_type')
    .gte('created_at', `${periodStart}T00:00:00`)
    .lte('created_at', `${periodEnd}T23:59:59`)
    .eq('is_internal', false)
    .not('booking_id', 'is', null)
    .limit(10000);

  // Build service map per booking
  const serviceMap = new Map<string, Set<string>>();
  (costs || []).forEach(c => {
    if (!c.booking_id) return;
    if (!serviceMap.has(c.booking_id)) serviceMap.set(c.booking_id, new Set());
    serviceMap.get(c.booking_id)!.add(c.service_type);
  });

  const records: ProcessedRecord[] = ((bookings || []) as unknown as BookingRow[]).map(b => {
    const services = serviceMap.get(b.id) || new Set<string>();
    const hasVoice = services.has('stt_transcription');
    const hasAny = services.size > 0;
    return {
      ...b,
      services,
      classification: hasVoice ? 'Voice' : hasAny ? 'Text' : '—',
    };
  });

  return records;
}

// ── Cover page ─────────────────────────────────────────────────────────────────

function drawCover(doc: jsPDF, periodStart: string, periodEnd: string, records: ProcessedRecord[], invoiceNumber?: string) {
  const pw = doc.internal.pageSize.getWidth();
  drawConfidential(doc);

  // Header
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 20, pw, 35, 'F');
  doc.setTextColor(255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Records Processing Detail Report', pw / 2, 38, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`${COMPANY.name}  →  ${CLIENT.name}`, pw / 2, 48, { align: 'center' });
  doc.setTextColor(0);

  let y = 75;

  // Period info
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Report Period', 14, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${format(parseISO(periodStart), 'MMMM d, yyyy')}  –  ${format(parseISO(periodEnd), 'MMMM d, yyyy')}`, 14, y);
  y += 5;
  doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, 14, y);
  if (invoiceNumber) {
    y += 5;
    doc.text(`Reference: ${invoiceNumber}`, 14, y);
  }
  y += 15;

  // Summary stats
  const withTranscription = records.filter(r => r.services.has('stt_transcription')).length;
  const withAnalysis = records.filter(r => r.services.has('ai_analysis')).length;
  const withQA = records.filter(r => SERVICE_KEYS.filter(k => k.includes('qa')).some(k => r.services.has(k))).length;
  const withCoaching = records.filter(r => ['ai_coaching', 'tts_coaching'].some(k => r.services.has(k))).length;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Processing Summary', 14, y);
  y += 10;

  const summaryRows = [
    ['Total Records', records.length.toLocaleString()],
    ['With Transcription', withTranscription.toLocaleString()],
    ['With AI Analysis', withAnalysis.toLocaleString()],
    ['With QA Scoring', withQA.toLocaleString()],
    ['With Coaching Audio', withCoaching.toLocaleString()],
  ];

  doc.setFontSize(10);
  summaryRows.forEach(([label, value], i) => {
    if (i % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(14, y - 5, pw - 28, 8, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.text(label, 18, y);
    doc.setFont('helvetica', 'bold');
    doc.text(value, pw - 18, y, { align: 'right' });
    y += 8;
  });
}

// ── Detail table (landscape) ───────────────────────────────────────────────────

function drawDetailTable(doc: jsPDF, records: ProcessedRecord[]) {
  const pw = doc.internal.pageSize.getWidth();

  // Column definitions for landscape
  const cols = [
    { label: '#', x: 16, w: 12, align: 'left' as const },
    { label: 'Date', x: 28, w: 22, align: 'left' as const },
    { label: 'Member', x: 50, w: 45, align: 'left' as const },
    { label: 'Market', x: 95, w: 35, align: 'left' as const },
    { label: 'Agent', x: 130, w: 35, align: 'left' as const },
    { label: 'Dur (s)', x: 165, w: 18, align: 'right' as const },
    { label: 'Transcribed', x: 185, w: 20, align: 'center' as const },
    { label: 'AI Analysis', x: 205, w: 20, align: 'center' as const },
    { label: 'QA Scored', x: 225, w: 18, align: 'center' as const },
    { label: 'Coaching', x: 243, w: 18, align: 'center' as const },
    { label: 'Class.', x: 261, w: 18, align: 'left' as const },
  ];

  const drawHeader = (y: number) => {
    doc.setFillColor(30, 58, 95);
    doc.rect(14, y - 5, pw - 28, 8, 'F');
    doc.setTextColor(255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    cols.forEach(c => doc.text(c.label, c.x, y, { align: c.align }));
    doc.setTextColor(0);
    return y + 7;
  };

  let y = 30;
  drawConfidential(doc);

  // Title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Processing Detail', 14, 20);
  y = drawHeader(y);

  records.forEach((r, i) => {
    if (needsNewPage(doc, y)) {
      doc.addPage('landscape');
      drawConfidential(doc);
      y = drawHeader(25);
    }

    if (i % 2 === 0) {
      doc.setFillColor(248, 249, 252);
      doc.rect(14, y - 4.5, pw - 28, 7, 'F');
    }

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');

    const check = (key: string) => r.services.has(key) ? '✓' : '—';

    doc.text(String(i + 1), cols[0].x, y, { align: 'left' });
    doc.text(format(parseISO(r.booking_date), 'MM/dd/yy'), cols[1].x, y);
    doc.text((r.member_name || '').substring(0, 22), cols[2].x, y);
    doc.text(r.market_city ? `${r.market_city}, ${r.market_state || ''}`.substring(0, 18) : '—', cols[3].x, y);
    doc.text(((r.agent as any)?.name || '—').substring(0, 18), cols[4].x, y);
    doc.text(r.call_duration_seconds != null ? String(r.call_duration_seconds) : '—', cols[5].x, y, { align: 'right' });
    doc.text(check('stt_transcription'), cols[6].x, y, { align: 'center' });
    doc.text(check('ai_analysis'), cols[7].x, y, { align: 'center' });
    doc.text(check('ai_qa_scoring'), cols[8].x, y, { align: 'center' });
    doc.text(r.services.has('ai_coaching') || r.services.has('tts_coaching') ? '✓' : '—', cols[9].x, y, { align: 'center' });
    doc.text(r.classification, cols[10].x, y);

    y += 7;
  });

  return y;
}

// ── Summary page ───────────────────────────────────────────────────────────────

function drawSummaryPage(doc: jsPDF, records: ProcessedRecord[]) {
  const pw = doc.internal.pageSize.getWidth();
  drawConfidential(doc);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Processing Summary', 14, 25);

  let y = 40;

  const countsByService: [string, number][] = SERVICE_KEYS.map(k => [
    SERVICE_TYPES[k],
    records.filter(r => r.services.has(k)).length,
  ]);

  // Add combined coaching row
  const coachingCount = records.filter(r => ['ai_coaching', 'tts_coaching'].some(k => r.services.has(k))).length;

  // Classification counts
  const voice = records.filter(r => r.classification === 'Voice').length;
  const text = records.filter(r => r.classification === 'Text').length;
  const unprocessed = records.filter(r => r.classification === '—').length;

  // Draw service breakdown
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('By Service Applied', 14, y);
  y += 10;

  // Header
  doc.setFillColor(30, 58, 95);
  doc.rect(14, y - 5, pw - 28, 8, 'F');
  doc.setTextColor(255);
  doc.setFontSize(9);
  doc.text('Service', 18, y);
  doc.text('Records', pw / 2, y, { align: 'center' });
  doc.text('% of Total', pw - 18, y, { align: 'right' });
  doc.setTextColor(0);
  y += 8;

  doc.setFontSize(9);
  countsByService.forEach(([label, count], i) => {
    if (i % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(14, y - 4.5, pw - 28, 7, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.text(label, 18, y);
    doc.text(count.toLocaleString(), pw / 2, y, { align: 'center' });
    doc.text(records.length > 0 ? `${((count / records.length) * 100).toFixed(1)}%` : '0%', pw - 18, y, { align: 'right' });
    y += 7;
  });

  y += 15;

  // Classification breakdown
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('By Classification', 14, y);
  y += 10;

  doc.setFillColor(30, 58, 95);
  doc.rect(14, y - 5, pw - 28, 8, 'F');
  doc.setTextColor(255);
  doc.setFontSize(9);
  doc.text('Classification', 18, y);
  doc.text('Records', pw / 2, y, { align: 'center' });
  doc.text('% of Total', pw - 18, y, { align: 'right' });
  doc.setTextColor(0);
  y += 8;

  const classRows = [
    ['Voice (with transcription)', voice],
    ['Text (no transcription)', text],
    ['Unprocessed', unprocessed],
    ['Total', records.length],
  ] as [string, number][];

  doc.setFontSize(9);
  classRows.forEach(([label, count], i) => {
    const isTotal = i === classRows.length - 1;
    if (isTotal) {
      doc.setFillColor(30, 58, 95);
      doc.rect(14, y - 4.5, pw - 28, 7, 'F');
      doc.setTextColor(255);
    } else if (i % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(14, y - 4.5, pw - 28, 7, 'F');
    }
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
    doc.text(label, 18, y);
    doc.text(count.toLocaleString(), pw / 2, y, { align: 'center' });
    doc.text(records.length > 0 ? `${((count / records.length) * 100).toFixed(1)}%` : '0%', pw - 18, y, { align: 'right' });
    if (isTotal) doc.setTextColor(0);
    y += 7;
  });
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function generateRecordsProcessingPDF(periodStart: string, periodEnd: string, invoiceNumber?: string) {
  const records = await fetchProcessingData(periodStart, periodEnd);

  // Page 1: Cover (portrait)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  drawCover(doc, periodStart, periodEnd, records, invoiceNumber);

  // Page 2+: Detail table (landscape)
  doc.addPage('landscape');
  drawDetailTable(doc, records);

  // Final page: Summary (portrait)
  doc.addPage('portrait');
  drawSummaryPage(doc, records);

  // Footer pass
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageFooter(doc, i, totalPages);
  }

  const periodLabel = `${format(parseISO(periodStart), 'yyyyMMdd')}-${format(parseISO(periodEnd), 'yyyyMMdd')}`;
  doc.save(`Records-Processing-Detail_${periodLabel}.pdf`);
}
