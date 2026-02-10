import jsPDF from 'jspdf';
import { BillingInvoice, Client, InvoiceLineItem } from '@/hooks/useBillingData';
import { SOW_CATEGORY_LABELS } from '@/utils/billingCalculations';
import { format, parseISO } from 'date-fns';

const fmtCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(amount);

export function generateInvoicePDF(
  invoice: BillingInvoice,
  client: Client | undefined,
  lineItems: InvoiceLineItem[]
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', 14, y);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Appendify, LLC', pageWidth - 14, y, { align: 'right' });
  y += 6;
  doc.setTextColor(100);
  doc.text('AI Processing & Analytics Services', pageWidth - 14, y, { align: 'right' });
  doc.setTextColor(0);

  y += 14;

  // Invoice metadata
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice Number:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.invoice_number || '—', 55, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', 110, y);
  doc.setFont('helvetica', 'normal');
  doc.text(format(parseISO(invoice.created_at), 'MMMM d, yyyy'), 125, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Billing Period:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${format(parseISO(invoice.period_start), 'MMM d')} – ${format(parseISO(invoice.period_end), 'MMM d, yyyy')}`, 55, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Due Date:', 110, y);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.due_date ? format(parseISO(invoice.due_date), 'MMMM d, yyyy') : '—', 135, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Payment Terms:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.payment_terms || 'Net 30', 55, y);
  y += 10;

  // Bill To
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(client?.name || 'Unknown Client', 14, y);
  y += 5;
  if (client?.contact_email) {
    doc.text(client.contact_email, 14, y);
    y += 5;
  }

  y += 8;

  // Line Items Table Header
  doc.setFillColor(240, 240, 240);
  doc.rect(14, y - 4, pageWidth - 28, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Service', 16, y);
  doc.text('Quantity', 110, y, { align: 'right' });
  doc.text('Unit Rate', 140, y, { align: 'right' });
  doc.text('Subtotal', pageWidth - 16, y, { align: 'right' });
  y += 8;

  // Line Items
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  lineItems.forEach((li) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    const label = SOW_CATEGORY_LABELS[li.service_category] || li.description;
    doc.text(label, 16, y);
    doc.text(Number(li.quantity).toLocaleString(), 110, y, { align: 'right' });
    doc.text(fmtCurrency(Number(li.unit_rate)), 140, y, { align: 'right' });
    doc.text(fmtCurrency(Number(li.subtotal)), pageWidth - 16, y, { align: 'right' });
    y += 6;
  });

  // If no line items, show from cost_breakdown
  if (lineItems.length === 0 && invoice.cost_breakdown?.lineItems) {
    (invoice.cost_breakdown.lineItems as any[]).forEach((li: any) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.text(li.description || SOW_CATEGORY_LABELS[li.category] || li.category, 16, y);
      doc.text(Number(li.quantity).toLocaleString(), 110, y, { align: 'right' });
      doc.text(fmtCurrency(li.unitRate), 140, y, { align: 'right' });
      doc.text(fmtCurrency(li.subtotal), pageWidth - 16, y, { align: 'right' });
      y += 6;
    });
  }

  y += 4;
  doc.setDrawColor(200);
  doc.line(14, y, pageWidth - 14, y);
  y += 8;

  // Totals
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total Due:', 110, y, { align: 'right' });
  doc.text(fmtCurrency(invoice.total_usd), pageWidth - 16, y, { align: 'right' });
  y += 12;

  // Notes
  if (invoice.notes) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Notes: ${invoice.notes}`, 14, y);
    doc.setTextColor(0);
    y += 10;
  }

  // Footer
  y = Math.max(y + 10, 260);
  if (y > 270) { doc.addPage(); y = 250; }
  doc.setDrawColor(200);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('No platform fees · No seat fees · No hidden costs · Strictly usage-based billing', 14, y);
  y += 4;
  doc.text('Governed by the Statement of Work (Appendify × PadSplit)', 14, y);

  // Download
  const filename = `${invoice.invoice_number || 'invoice'}-${format(parseISO(invoice.period_end), 'yyyy-MM')}.pdf`;
  doc.save(filename);
}
