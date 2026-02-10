

# Rebuild Invoice PDF to Match SOW Template

## Overview
Replace the current simple 1-page PDF generator with a professional 5-page invoice matching the uploaded Appendify template exactly. The new PDF includes branded headers, an Invoice Summary paragraph, a numbered Service Charges table, Payment Instructions with ACH/Check details, and a full Appendix A with per-category reconciliation tables and a certification block.

---

## Page Structure (matching the .docx)

### Page 1 -- Invoice Header + Service Charges
- "CONFIDENTIAL" watermark top-right
- "INVOICE" title with Appendify, LLC branding
- Left column: Invoice Number, Billing Period, Payment Terms, Email, Phone
- Right column: Invoice Date, Due Date
- "BILL TO" section: PadSplit, Inc. with address and contact
- Invoice Summary paragraph (the SOW transparency statement)
- **Service Charges table** with numbered rows:
  1. AI Processing - Voice-Based Records
  2. AI Processing - Text-Based Records
  3. Data Appending and Enrichment
  4. Communication Delivery - SMS
  5. Communication Delivery - Email
  6. Telephony Usage
  7. Voice Feedback, QA, and Sales Coaching
- Columns: #, Service Description, Billing Basis, Qty, Unit Price, Total
- Footer: "Appendify, LLC | Invoice | Page X"

### Page 2 -- Totals + Payment Instructions
- Subtotal, Taxes (if applicable), Total Amount Due
- Payment Instructions section:
  - ACH / Wire Transfer details (bank, routing, account, reference)
  - Check payable info and mailing address
- Note: "Please include the invoice number on all payments"

### Pages 3-4 -- Appendix A: Billing Reconciliation
- Per-category reconciliation tables (7 categories), each showing:
  - Total records received/initiated
  - Records successfully processed and billed
  - Records failed or excluded (not billed)
  - Volume tier / unit rate applied
  - Subtotal
- Categories: Voice, Text, Data Appending, SMS, Email, Telephony, Voice Coaching

### Page 5 -- Billing Controls and Certification
- Billing Controls bullet points (only successful records billed, volume discounts auto-applied, etc.)
- Certification block with signature lines (Name, Date, Title)
- "End of Document"

---

## Technical Details

### Files Modified
- `src/components/billing/InvoicePDFGenerator.tsx` -- Complete rewrite to produce the 5-page format

### Data Requirements
The existing `generateInvoicePDF(invoice, client, lineItems)` signature stays the same. All needed data (quantities, rates, subtotals) is already available in the `lineItems` array and `invoice` object. The reconciliation tables will use the same quantities, marking failed/excluded as 0 (since we only bill successfully processed records).

### New Data Needed for Payment Instructions
The payment instructions (bank name, routing number, account number, mailing address) will be hardcoded as configurable constants at the top of the file, since these are Appendify's own banking details and don't change per invoice. The client billing address fields will use existing `client` data, with placeholders for address fields not yet stored.

### Approach
- Use jsPDF (already installed) with manual layout
- Helper functions for: drawing reconciliation tables, page headers/footers, the service charges table
- Each page gets the "CONFIDENTIAL" mark and "Appendify, LLC | Invoice/Appendix A | Page N" footer
- Currency formatting uses 2 decimal places for totals, up to 4 for unit rates (e.g., $0.012)
- Only show line items where quantity > 0 in the service charges table; show all 7 categories in reconciliation with 0s where not applicable
