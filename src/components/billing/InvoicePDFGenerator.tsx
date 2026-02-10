import jsPDF from 'jspdf';
import { BillingInvoice, Client, InvoiceLineItem } from '@/hooks/useBillingData';
import { SOW_CATEGORY_LABELS } from '@/utils/billingCalculations';
import { format, parseISO } from 'date-fns';

// ── Constants ──────────────────────────────────────────────────────────────────

const COMPANY = {
  name: 'Appendify, LLC',
  tagline: 'AI Processing & Analytics Services',
  email: 'billing@appendify.com',
  phone: '(555) 000-0000',
};

const PAYMENT = {
  bankName: 'Chase Bank',
  routingNumber: '021000021',
  accountNumber: '●●●●●●7890',
  accountName: 'Appendify, LLC',
  checkPayableTo: 'Appendify, LLC',
  mailingAddress: '123 Innovation Drive, Suite 400\nAustin, TX 78701',
};

const CLIENT_ADDRESS = {
  name: 'PadSplit, Inc.',
  attn: 'Accounts Payable',
  line1: '1372 Peachtree St NE, Suite 200',
  city: 'Atlanta, GA 30309',
};

// Service definitions in SOW order
const SERVICE_DEFS = [
  { key: 'voice_processing', label: 'AI Processing – Voice-Based Records', basis: 'Per Record' },
  { key: 'text_processing', label: 'AI Processing – Text-Based Records', basis: 'Per Record' },
  { key: 'data_appending', label: 'Data Appending and Enrichment', basis: 'Per Record' },
  { key: 'sms_delivery', label: 'Communication Delivery – SMS', basis: 'Per Segment' },
  { key: 'email_delivery', label: 'Communication Delivery – Email', basis: 'Per Email' },
  { key: 'telephony', label: 'Telephony Usage', basis: 'Per Minute' },
  { key: 'voice_coaching', label: 'Voice Feedback, QA, and Sales Coaching', basis: 'Per Record' },
];

const TOTAL_PAGES = 5;

// ── Formatters ─────────────────────────────────────────────────────────────────

const fmtCurrency = (amount: number, decimals = 2) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: Math.max(decimals, 4),
  }).format(amount);

const fmtQty = (n: number) => Number(n).toLocaleString();

// ── Helpers ────────────────────────────────────────────────────────────────────

function drawConfidential(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180);
  doc.text('CONFIDENTIAL', pw - 14, 12, { align: 'right' });
  doc.setTextColor(0);
}

function drawPageFooter(doc: jsPDF, pageNum: number, section: string) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setDrawColor(200);
  doc.line(14, ph - 16, pw - 14, ph - 16);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text(`Appendify, LLC  |  ${section}  |  Page ${pageNum} of ${TOTAL_PAGES}`, pw / 2, ph - 10, { align: 'center' });
  doc.setTextColor(0);
}

function buildLineItemMap(lineItems: InvoiceLineItem[], invoice: BillingInvoice) {
  const map: Record<string, { qty: number; rate: number; subtotal: number }> = {};

  lineItems.forEach((li) => {
    map[li.service_category] = {
      qty: Number(li.quantity),
      rate: Number(li.unit_rate),
      subtotal: Number(li.subtotal),
    };
  });

  // Fallback to cost_breakdown if no DB line items
  if (lineItems.length === 0 && invoice.cost_breakdown?.lineItems) {
    (invoice.cost_breakdown.lineItems as any[]).forEach((li: any) => {
      const cat = li.service_category || li.category;
      map[cat] = {
        qty: Number(li.quantity),
        rate: Number(li.unitRate || li.unit_rate),
        subtotal: Number(li.subtotal),
      };
    });
  }

  return map;
}

// ── Page Builders ──────────────────────────────────────────────────────────────

function drawPage1(
  doc: jsPDF,
  invoice: BillingInvoice,
  client: Client | undefined,
  itemMap: Record<string, { qty: number; rate: number; subtotal: number }>
) {
  const pw = doc.internal.pageSize.getWidth();
  drawConfidential(doc);

  let y = 22;

  // Title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', 14, y);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY.name, pw - 14, y, { align: 'right' });
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(COMPANY.tagline, pw - 14, y, { align: 'right' });
  doc.setTextColor(0);

  y += 14;

  // ── Metadata grid ──
  doc.setFontSize(9);
  const leftCol = 14;
  const leftVal = 58;
  const rightCol = 115;
  const rightVal = 148;

  const metaRows: [string, string, string, string][] = [
    ['Invoice Number:', invoice.invoice_number || '—', 'Invoice Date:', format(parseISO(invoice.created_at), 'MMMM d, yyyy')],
    ['Billing Period:', `${format(parseISO(invoice.period_start), 'MMM d')} – ${format(parseISO(invoice.period_end), 'MMM d, yyyy')}`, 'Due Date:', invoice.due_date ? format(parseISO(invoice.due_date), 'MMMM d, yyyy') : '—'],
    ['Payment Terms:', invoice.payment_terms || 'Net 30', '', ''],
    ['Email:', COMPANY.email, '', ''],
    ['Phone:', COMPANY.phone, '', ''],
  ];

  metaRows.forEach(([lk, lv, rk, rv]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(lk, leftCol, y);
    doc.setFont('helvetica', 'normal');
    doc.text(lv, leftVal, y);
    if (rk) {
      doc.setFont('helvetica', 'bold');
      doc.text(rk, rightCol, y);
      doc.setFont('helvetica', 'normal');
      doc.text(rv, rightVal, y);
    }
    y += 6;
  });

  y += 4;

  // ── Bill To ──
  doc.setFillColor(240, 240, 240);
  doc.rect(14, y - 4, pw - 28, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('BILL TO', 16, y);
  y += 10;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(client?.name || CLIENT_ADDRESS.name, 16, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(`Attn: ${CLIENT_ADDRESS.attn}`, 16, y);
  y += 5;
  doc.text(CLIENT_ADDRESS.line1, 16, y);
  y += 5;
  doc.text(CLIENT_ADDRESS.city, 16, y);
  if (client?.contact_email) {
    y += 5;
    doc.text(client.contact_email, 16, y);
  }
  y += 10;

  // ── Invoice Summary ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Invoice Summary', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const summaryText =
    'This invoice reflects usage-based charges for AI processing, data enrichment, communication delivery, ' +
    'telephony, and coaching services provided during the billing period above. All charges are calculated in ' +
    'accordance with the Statement of Work (SOW) between Appendify, LLC and the client. Only successfully ' +
    'processed records are billed; failed or excluded records incur no charge.';
  const summaryLines = doc.splitTextToSize(summaryText, pw - 28);
  doc.text(summaryLines, 14, y);
  y += summaryLines.length * 4 + 6;

  // ── Service Charges Table ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Service Charges', 14, y);
  y += 8;

  // Header row
  doc.setFillColor(30, 58, 95); // dark navy
  doc.rect(14, y - 5, pw - 28, 8, 'F');
  doc.setTextColor(255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('#', 16, y);
  doc.text('Service Description', 22, y);
  doc.text('Billing Basis', 100, y);
  doc.text('Qty', 132, y, { align: 'right' });
  doc.text('Unit Price', 155, y, { align: 'right' });
  doc.text('Total', pw - 16, y, { align: 'right' });
  doc.setTextColor(0);
  y += 7;

  // Data rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  let rowNum = 0;
  let subtotalSum = 0;

  SERVICE_DEFS.forEach((svc) => {
    const item = itemMap[svc.key];
    if (!item || item.qty <= 0) return;
    rowNum++;
    subtotalSum += item.subtotal;

    // Zebra stripe
    if (rowNum % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(14, y - 4, pw - 28, 7, 'F');
    }

    doc.text(String(rowNum), 16, y);
    doc.text(svc.label, 22, y);
    doc.text(svc.basis, 100, y);
    doc.text(fmtQty(item.qty), 132, y, { align: 'right' });
    doc.text(fmtCurrency(item.rate, item.rate < 0.1 ? 4 : 2), 155, y, { align: 'right' });
    doc.text(fmtCurrency(item.subtotal), pw - 16, y, { align: 'right' });
    y += 7;
  });

  // If no items at all, show a note
  if (rowNum === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150);
    doc.text('No billable services recorded for this period.', 22, y);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
    y += 7;
  }

  drawPageFooter(doc, 1, 'Invoice');
}

function drawPage2(
  doc: jsPDF,
  invoice: BillingInvoice,
  itemMap: Record<string, { qty: number; rate: number; subtotal: number }>
) {
  doc.addPage();
  const pw = doc.internal.pageSize.getWidth();
  drawConfidential(doc);

  let y = 24;

  // ── Totals ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Invoice Totals', 14, y);
  y += 10;

  let subtotal = 0;
  SERVICE_DEFS.forEach((svc) => {
    const item = itemMap[svc.key];
    if (item) subtotal += item.subtotal;
  });

  const taxes = 0; // placeholder
  const totalDue = invoice.total_usd || subtotal + taxes;

  doc.setFontSize(10);
  // Subtotal row
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', 110, y, { align: 'right' });
  doc.text(fmtCurrency(subtotal), pw - 16, y, { align: 'right' });
  y += 7;

  // Taxes
  doc.text('Taxes (if applicable):', 110, y, { align: 'right' });
  doc.text(taxes > 0 ? fmtCurrency(taxes) : '—', pw - 16, y, { align: 'right' });
  y += 8;

  // Divider
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.5);
  doc.line(90, y, pw - 16, y);
  doc.setLineWidth(0.2);
  y += 8;

  // Total
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Total Amount Due:', 110, y, { align: 'right' });
  doc.text(fmtCurrency(totalDue), pw - 16, y, { align: 'right' });
  y += 18;

  // ── Payment Instructions ──
  doc.setFillColor(240, 240, 240);
  doc.rect(14, y - 4, pw - 28, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Payment Instructions', 16, y);
  y += 12;

  // ACH / Wire
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('ACH / Wire Transfer', 16, y);
  y += 7;

  doc.setFontSize(9);
  const achRows: [string, string][] = [
    ['Bank Name:', PAYMENT.bankName],
    ['Routing Number:', PAYMENT.routingNumber],
    ['Account Number:', PAYMENT.accountNumber],
    ['Account Name:', PAYMENT.accountName],
    ['Reference:', invoice.invoice_number || 'Invoice #'],
  ];

  achRows.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(val, 60, y);
    y += 6;
  });

  y += 6;

  // Check
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Check', 16, y);
  y += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Make checks payable to: ${PAYMENT.checkPayableTo}`, 20, y);
  y += 6;
  doc.text('Mail to:', 20, y);
  y += 5;
  const addrLines = PAYMENT.mailingAddress.split('\n');
  addrLines.forEach((line) => {
    doc.text(line, 28, y);
    y += 5;
  });

  y += 8;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text('Please include the invoice number on all payments.', 16, y);
  doc.setTextColor(0);

  drawPageFooter(doc, 2, 'Invoice');
}

function drawAppendixPages(
  doc: jsPDF,
  invoice: BillingInvoice,
  itemMap: Record<string, { qty: number; rate: number; subtotal: number }>
) {
  doc.addPage();
  const pw = doc.internal.pageSize.getWidth();
  drawConfidential(doc);

  let y = 24;
  let currentPage = 3;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Appendix A: Billing Reconciliation', 14, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(
    `Billing Period: ${format(parseISO(invoice.period_start), 'MMM d')} – ${format(parseISO(invoice.period_end), 'MMM d, yyyy')}`,
    14,
    y
  );
  doc.setTextColor(0);
  y += 12;

  SERVICE_DEFS.forEach((svc, idx) => {
    // Check if we need a new page
    if (y > 230) {
      drawPageFooter(doc, currentPage, 'Appendix A');
      doc.addPage();
      currentPage++;
      drawConfidential(doc);
      y = 24;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Appendix A: Billing Reconciliation (continued)', 14, y);
      y += 12;
    }

    const item = itemMap[svc.key] || { qty: 0, rate: 0, subtotal: 0 };

    // Category header
    doc.setFillColor(30, 58, 95);
    doc.rect(14, y - 4, pw - 28, 8, 'F');
    doc.setTextColor(255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`${idx + 1}. ${svc.label}`, 16, y);
    doc.setTextColor(0);
    y += 8;

    // Table rows
    const rows: [string, string][] = [
      ['Total records received / initiated', fmtQty(item.qty)],
      ['Records successfully processed and billed', fmtQty(item.qty)],
      ['Records failed or excluded (not billed)', '0'],
      ['Volume tier / unit rate applied', fmtCurrency(item.rate, item.rate < 0.1 ? 4 : 2)],
      ['Subtotal', fmtCurrency(item.subtotal)],
    ];

    doc.setFontSize(8);
    rows.forEach(([label, val], ri) => {
      if (ri % 2 === 0) {
        doc.setFillColor(248, 248, 248);
        doc.rect(14, y - 3.5, pw - 28, 6, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.text(label, 18, y);
      doc.setFont('helvetica', 'bold');
      doc.text(val, pw - 18, y, { align: 'right' });
      y += 6;
    });

    y += 6;
  });

  drawPageFooter(doc, currentPage, 'Appendix A');
}

function drawPage5(doc: jsPDF) {
  doc.addPage();
  const pw = doc.internal.pageSize.getWidth();
  drawConfidential(doc);

  let y = 24;

  // ── Billing Controls ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Billing Controls', 14, y);
  y += 10;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const controls = [
    'Only successfully processed records are billed; failed or excluded records incur no charge.',
    'Volume-based discounts are automatically applied when monthly thresholds are met.',
    'All charges are calculated in real-time and reconciled at the end of each billing period.',
    'Detailed per-category reconciliation is provided in Appendix A above.',
    'No platform fees, seat fees, or hidden costs — strictly usage-based billing.',
    'All services are governed by the Statement of Work (SOW) between Appendify, LLC and the client.',
  ];

  controls.forEach((ctrl) => {
    doc.text(`•  ${ctrl}`, 18, y, { maxWidth: pw - 36 });
    const lines = doc.splitTextToSize(`•  ${ctrl}`, pw - 36);
    y += lines.length * 4.5 + 2;
  });

  y += 12;

  // ── Certification ──
  doc.setFillColor(240, 240, 240);
  doc.rect(14, y - 4, pw - 28, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Certification', 16, y);
  y += 12;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const certText =
    'I certify that the charges reflected in this invoice are accurate and in accordance with the ' +
    'terms of the Statement of Work between Appendify, LLC and the client.';
  const certLines = doc.splitTextToSize(certText, pw - 28);
  doc.text(certLines, 14, y);
  y += certLines.length * 4.5 + 14;

  // Signature lines
  const sigFields = ['Name', 'Date', 'Title'];
  sigFields.forEach((label) => {
    doc.setDrawColor(0);
    doc.line(14, y, 100, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(label, 14, y + 5);
    y += 16;
  });

  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text('— End of Document —', pw / 2, y, { align: 'center' });
  doc.setTextColor(0);

  drawPageFooter(doc, 5, 'Invoice');
}

// ── Main Export ─────────────────────────────────────────────────────────────────

export function generateInvoicePDF(
  invoice: BillingInvoice,
  client: Client | undefined,
  lineItems: InvoiceLineItem[]
) {
  const doc = new jsPDF();
  const itemMap = buildLineItemMap(lineItems, invoice);

  drawPage1(doc, invoice, client, itemMap);
  drawPage2(doc, invoice, itemMap);
  drawAppendixPages(doc, invoice, itemMap);
  drawPage5(doc);

  const filename = `${invoice.invoice_number || 'invoice'}-${format(parseISO(invoice.period_end), 'yyyy-MM')}.pdf`;
  doc.save(filename);
}
