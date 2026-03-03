import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';

// ── Constants (matching InvoicePDFGenerator style) ─────────────────────────────

const COMPANY = {
  name: 'Appendify, LLC',
  tagline: 'AI Processing & Analytics Services',
};

const CLIENT = {
  name: 'PadSplit, Inc.',
};

const SOW_RATES: Record<string, number> = {
  voice_processing: 0.15,
  text_processing: 0.04,
  email_delivery: 0.03,
  sms_delivery: 0.05,
};

const fmtCurrency = (amount: number, decimals = 2) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: Math.max(decimals, 4),
  }).format(amount);

// ── Helpers ────────────────────────────────────────────────────────────────────

function drawConfidential(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180);
  doc.text('CONFIDENTIAL', pw - 14, 12, { align: 'right' });
  doc.setTextColor(0);
}

function drawPageFooter(doc: jsPDF, pageNum: number, totalPages: number, section: string) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setDrawColor(200);
  doc.line(14, ph - 16, pw - 14, ph - 16);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text(`Appendify, LLC  |  ${section}  |  Page ${pageNum} of ${totalPages}`, pw / 2, ph - 10, { align: 'center' });
  doc.setTextColor(0);
}

function drawTableHeader(doc: jsPDF, y: number, columns: { label: string; x: number; align?: 'left' | 'right' }[]) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(30, 58, 95);
  doc.rect(14, y - 5, pw - 28, 8, 'F');
  doc.setTextColor(255);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  columns.forEach(col => {
    doc.text(col.label, col.x, y, { align: col.align || 'left' });
  });
  doc.setTextColor(0);
  return y + 7;
}

function needsNewPage(doc: jsPDF, y: number, margin = 30): boolean {
  return y > doc.internal.pageSize.getHeight() - margin;
}

// ── Data Fetching ──────────────────────────────────────────────────────────────

interface BookingRecord {
  id: string;
  booking_date: string;
  member_name: string;
  market_city: string | null;
  market_state: string | null;
  call_duration_seconds: number | null;
  import_batch_id: string | null;
  agent: { name: string } | null;
}

interface CommRecord {
  communication_type: string;
  sent_at: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  status: string;
}

async function fetchUsageData(periodStart: string, periodEnd: string) {
  // 1. Bookings in period
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, booking_date, member_name, market_city, market_state, call_duration_seconds, import_batch_id, agent:agents(name)')
    .gte('booking_date', periodStart)
    .lte('booking_date', periodEnd)
    .neq('record_type', 'research')
    .order('booking_date', { ascending: true })
    .limit(5000);

  // 2. API costs joined by booking_id (anchored to booking_date, not created_at)
  const bookingIds = (bookings || []).map((b: any) => b.id);
  let costs: any[] = [];
  if (bookingIds.length > 0) {
    const { data } = await supabase
      .from('api_costs')
      .select('booking_id, service_type')
      .in('booking_id', bookingIds)
      .eq('is_internal', false)
      .limit(5000);
    costs = data || [];
  }

  // 3. Communications
  const { data: comms } = await supabase
    .from('contact_communications')
    .select('communication_type, sent_at, recipient_email, recipient_phone, status')
    .gte('sent_at', `${periodStart}T00:00:00`)
    .lte('sent_at', `${periodEnd}T23:59:59`)
    .limit(5000);

  const voiceBookingIds = new Set(
    (costs || []).filter(c => c.service_type === 'stt_transcription' && c.booking_id).map(c => c.booking_id)
  );
  const allProcessedIds = new Set(
    (costs || []).filter(c => c.booking_id).map(c => c.booking_id)
  );

  const allBookings = (bookings || []) as unknown as BookingRecord[];

  const voiceRecords = allBookings.filter(b => voiceBookingIds.has(b.id));
  const textRecords = allBookings.filter(b => allProcessedIds.has(b.id) && !voiceBookingIds.has(b.id));

  const emails = (comms || []).filter((c: CommRecord) => c.communication_type === 'email');
  const sms = (comms || []).filter((c: CommRecord) => c.communication_type === 'sms');

  return { voiceRecords, textRecords, emails, sms };
}

// ── Page: Cover + Summary ──────────────────────────────────────────────────────

function drawCoverPage(
  doc: jsPDF,
  periodStart: string,
  periodEnd: string,
  invoiceNumber: string | undefined,
  summary: { voice: number; text: number; emails: number; sms: number },
  totalPages: number,
) {
  const pw = doc.internal.pageSize.getWidth();
  drawConfidential(doc);

  let y = 28;

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Usage Detail Report', 14, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`${COMPANY.name} → ${CLIENT.name}`, 14, y);
  doc.setTextColor(0);
  y += 14;

  // Metadata
  doc.setFontSize(9);
  const meta: [string, string][] = [
    ['Billing Period:', `${format(parseISO(periodStart), 'MMMM d, yyyy')} – ${format(parseISO(periodEnd), 'MMMM d, yyyy')}`],
    ['Generated:', format(new Date(), 'MMMM d, yyyy h:mm a')],
  ];
  if (invoiceNumber) meta.push(['Supporting Invoice:', invoiceNumber]);

  meta.forEach(([k, v]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(k, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(v, 60, y);
    y += 6;
  });

  y += 10;

  // Summary table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Usage Summary', 14, y);
  y += 8;

  const cols = [
    { label: 'Category', x: 16 },
    { label: 'Count', x: 110, align: 'right' as const },
    { label: 'SOW Rate', x: 145, align: 'right' as const },
    { label: 'Subtotal', x: pw - 16, align: 'right' as const },
  ];
  y = drawTableHeader(doc, y, cols);

  const rows = [
    { label: 'Voice-Based Records (AI Processing)', count: summary.voice, rate: SOW_RATES.voice_processing },
    { label: 'Text-Based Records (AI Processing)', count: summary.text, rate: SOW_RATES.text_processing },
    { label: 'Email Delivery', count: summary.emails, rate: SOW_RATES.email_delivery },
    { label: 'SMS Delivery', count: summary.sms, rate: SOW_RATES.sms_delivery },
  ];

  doc.setFontSize(8);
  let grandTotal = 0;
  rows.forEach((row, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(14, y - 4, pw - 28, 7, 'F');
    }
    const sub = row.count * row.rate;
    grandTotal += sub;
    doc.setFont('helvetica', 'normal');
    doc.text(row.label, 16, y);
    doc.text(row.count.toLocaleString(), 110, y, { align: 'right' });
    doc.text(fmtCurrency(row.rate, row.rate < 0.1 ? 4 : 2), 145, y, { align: 'right' });
    doc.text(fmtCurrency(sub), pw - 16, y, { align: 'right' });
    y += 7;
  });

  // Grand total
  y += 2;
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.5);
  doc.line(100, y, pw - 14, y);
  doc.setLineWidth(0.2);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Grand Total:', 110, y, { align: 'right' });
  doc.text(fmtCurrency(grandTotal), pw - 16, y, { align: 'right' });

  drawPageFooter(doc, 1, totalPages, 'Usage Detail Report');
}

// ── Page: Record Detail Table ──────────────────────────────────────────────────

function drawRecordDetailPages(
  doc: jsPDF,
  records: BookingRecord[],
  sectionTitle: string,
  processingType: string,
  rate: number,
  startPage: number,
  totalPages: number,
): number {
  if (records.length === 0) return startPage;

  doc.addPage();
  const pw = doc.internal.pageSize.getWidth();
  drawConfidential(doc);
  let currentPage = startPage;
  let y = 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(sectionTitle, 14, y);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`${records.length.toLocaleString()} records  |  ${fmtCurrency(rate)}/record  |  Subtotal: ${fmtCurrency(records.length * rate)}`, 14, y + 6);
  doc.setTextColor(0);
  y += 14;

  const cols = [
    { label: '#', x: 16 },
    { label: 'Record Date', x: 24 },
    { label: 'Member Name', x: 52 },
    { label: 'Market', x: 100 },
    { label: 'Duration', x: 140, align: 'right' as const },
    { label: 'Type', x: 158 },
    { label: 'Rate', x: pw - 16, align: 'right' as const },
  ];
  y = drawTableHeader(doc, y, cols);

  doc.setFontSize(7);
  records.forEach((rec, i) => {
    if (needsNewPage(doc, y)) {
      drawPageFooter(doc, currentPage, totalPages, sectionTitle);
      doc.addPage();
      currentPage++;
      drawConfidential(doc);
      y = 24;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`${sectionTitle} (continued)`, 14, y);
      y += 8;
      y = drawTableHeader(doc, y, cols);
      doc.setFontSize(7);
    }

    if (i % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(14, y - 4, pw - 28, 6, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.text(String(i + 1), 16, y);
    doc.text(format(parseISO(rec.booking_date), 'MM/dd/yyyy'), 24, y);
    const name = rec.member_name.length > 22 ? rec.member_name.substring(0, 20) + '…' : rec.member_name;
    doc.text(name, 52, y);
    const market = [rec.market_city, rec.market_state].filter(Boolean).join(', ') || '—';
    const marketTrunc = market.length > 18 ? market.substring(0, 16) + '…' : market;
    doc.text(marketTrunc, 100, y);
    const dur = rec.call_duration_seconds ? `${Math.floor(rec.call_duration_seconds / 60)}:${String(rec.call_duration_seconds % 60).padStart(2, '0')}` : '—';
    doc.text(dur, 140, y, { align: 'right' });
    doc.text(processingType, 158, y);
    doc.text(fmtCurrency(rate), pw - 16, y, { align: 'right' });
    y += 6;
  });

  // Subtotal row
  y += 2;
  doc.setFillColor(30, 58, 95);
  doc.rect(14, y - 4, pw - 28, 7, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`Subtotal: ${records.length.toLocaleString()} records`, 16, y);
  doc.text(fmtCurrency(records.length * rate), pw - 16, y, { align: 'right' });
  doc.setTextColor(0);

  drawPageFooter(doc, currentPage, totalPages, sectionTitle);
  return currentPage + 1;
}

// ── Page: Communication Detail ─────────────────────────────────────────────────

function drawCommunicationPage(
  doc: jsPDF,
  emails: CommRecord[],
  sms: CommRecord[],
  startPage: number,
  totalPages: number,
): number {
  if (emails.length === 0 && sms.length === 0) return startPage;

  doc.addPage();
  const pw = doc.internal.pageSize.getWidth();
  drawConfidential(doc);
  let currentPage = startPage;
  let y = 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Communication Detail', 14, y);
  y += 10;

  const drawCommSection = (title: string, records: CommRecord[], type: 'email' | 'sms') => {
    if (records.length === 0) return;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${title} (${records.length})`, 14, y);
    y += 8;

    const cols = [
      { label: '#', x: 16 },
      { label: 'Date', x: 24 },
      { label: type === 'email' ? 'Recipient Email' : 'Recipient Phone', x: 60 },
      { label: 'Status', x: 140 },
      { label: 'Rate', x: pw - 16, align: 'right' as const },
    ];
    y = drawTableHeader(doc, y, cols);

    doc.setFontSize(7);
    records.forEach((rec, i) => {
      if (needsNewPage(doc, y)) {
        drawPageFooter(doc, currentPage, totalPages, 'Communication Detail');
        doc.addPage();
        currentPage++;
        drawConfidential(doc);
        y = 24;
        y = drawTableHeader(doc, y, cols);
        doc.setFontSize(7);
      }

      if (i % 2 === 0) {
        doc.setFillColor(248, 248, 248);
        doc.rect(14, y - 4, pw - 28, 6, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.text(String(i + 1), 16, y);
      doc.text(format(parseISO(rec.sent_at), 'MM/dd/yyyy HH:mm'), 24, y);
      const recipient = (type === 'email' ? rec.recipient_email : rec.recipient_phone) || '—';
      const recipientTrunc = recipient.length > 35 ? recipient.substring(0, 33) + '…' : recipient;
      doc.text(recipientTrunc, 60, y);
      doc.text(rec.status || '—', 140, y);
      doc.text(fmtCurrency(type === 'email' ? SOW_RATES.email_delivery : SOW_RATES.sms_delivery), pw - 16, y, { align: 'right' });
      y += 6;
    });

    y += 8;
  };

  drawCommSection('Emails Sent', emails, 'email');
  drawCommSection('SMS Sent', sms, 'sms');

  drawPageFooter(doc, currentPage, totalPages, 'Communication Detail');
  return currentPage + 1;
}

// ── Page: Reconciliation ───────────────────────────────────────────────────────

function drawReconciliation(
  doc: jsPDF,
  summary: { voice: number; text: number; emails: number; sms: number },
  invoiceNumber: string | undefined,
  periodStart: string,
  periodEnd: string,
  pageNum: number,
  totalPages: number,
) {
  doc.addPage();
  const pw = doc.internal.pageSize.getWidth();
  drawConfidential(doc);
  let y = 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Reconciliation Summary', 14, y);
  y += 10;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Period: ${format(parseISO(periodStart), 'MMM d')} – ${format(parseISO(periodEnd), 'MMM d, yyyy')}`, 14, y);
  doc.setTextColor(0);
  y += 10;

  const cols = [
    { label: 'Service Category', x: 16 },
    { label: 'Quantity', x: 110, align: 'right' as const },
    { label: 'Unit Rate', x: 145, align: 'right' as const },
    { label: 'Total', x: pw - 16, align: 'right' as const },
  ];
  y = drawTableHeader(doc, y, cols);

  const rows = [
    { label: 'AI Processing – Voice Records', qty: summary.voice, rate: SOW_RATES.voice_processing },
    { label: 'AI Processing – Text Records', qty: summary.text, rate: SOW_RATES.text_processing },
    { label: 'Email Delivery', qty: summary.emails, rate: SOW_RATES.email_delivery },
    { label: 'SMS Delivery', qty: summary.sms, rate: SOW_RATES.sms_delivery },
  ];

  let grandTotal = 0;
  doc.setFontSize(8);
  rows.forEach((row, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(14, y - 4, pw - 28, 7, 'F');
    }
    const sub = row.qty * row.rate;
    grandTotal += sub;
    doc.setFont('helvetica', 'normal');
    doc.text(row.label, 16, y);
    doc.text(row.qty.toLocaleString(), 110, y, { align: 'right' });
    doc.text(fmtCurrency(row.rate, row.rate < 0.1 ? 4 : 2), 145, y, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(fmtCurrency(sub), pw - 16, y, { align: 'right' });
    y += 7;
  });

  // Grand total
  y += 4;
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.5);
  doc.line(100, y, pw - 14, y);
  doc.setLineWidth(0.2);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Grand Total:', 110, y, { align: 'right' });
  doc.text(fmtCurrency(grandTotal), pw - 16, y, { align: 'right' });

  y += 20;

  // Statement
  if (invoiceNumber) {
    doc.setFillColor(240, 240, 240);
    doc.rect(14, y - 4, pw - 28, 12, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text(`This usage detail report supports Invoice ${invoiceNumber}.`, 16, y + 2);
    y += 16;
  }

  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text('— End of Usage Detail Report —', pw / 2, y, { align: 'center' });
  doc.setTextColor(0);

  drawPageFooter(doc, pageNum, totalPages, 'Reconciliation');
}

// ── Main Export ─────────────────────────────────────────────────────────────────

export async function generateUsageDetailPDF(
  periodStart: string,
  periodEnd: string,
  invoiceNumber?: string,
): Promise<void> {
  const data = await fetchUsageData(periodStart, periodEnd);

  const summary = {
    voice: data.voiceRecords.length,
    text: data.textRecords.length,
    emails: data.emails.length,
    sms: data.sms.length,
  };

  // Estimate total pages (cover + voice + text + comms + reconciliation)
  const hasVoice = data.voiceRecords.length > 0;
  const hasText = data.textRecords.length > 0;
  const hasComms = data.emails.length > 0 || data.sms.length > 0;
  let estPages = 1; // cover
  if (hasVoice) estPages += Math.max(1, Math.ceil(data.voiceRecords.length / 40));
  if (hasText) estPages += Math.max(1, Math.ceil(data.textRecords.length / 40));
  if (hasComms) estPages += 1;
  estPages += 1; // reconciliation

  const doc = new jsPDF();

  // Page 1: Cover
  drawCoverPage(doc, periodStart, periodEnd, invoiceNumber, summary, estPages);

  // Pages 2+: Voice records
  let nextPage = 2;
  nextPage = drawRecordDetailPages(doc, data.voiceRecords, 'Voice Record Detail', 'Voice', SOW_RATES.voice_processing, nextPage, estPages);

  // Text records
  nextPage = drawRecordDetailPages(doc, data.textRecords, 'Text Record Detail', 'Text', SOW_RATES.text_processing, nextPage, estPages);

  // Communications
  nextPage = drawCommunicationPage(doc, data.emails as CommRecord[], data.sms as CommRecord[], nextPage, estPages);

  // Reconciliation
  drawReconciliation(doc, summary, invoiceNumber, periodStart, periodEnd, nextPage, estPages);

  const filename = `usage-detail-${periodStart}-to-${periodEnd}.pdf`;
  doc.save(filename);
}
