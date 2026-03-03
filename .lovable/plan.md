

## Detailed Usage Report for PadSplit

### What we're building

A **Usage Detail Report** PDF that supplements the existing invoice with per-record evidence. This will be a new PDF generator that produces a supporting document showing every booking processed during the billing period, categorized by processing type (voice vs text), with individual record details.

### Report structure (PDF pages)

```text
Page 1: Cover + Summary
  - "Usage Detail Report" title
  - Appendify, LLC → PadSplit, Inc. header
  - Billing period
  - Summary table: total voice records, text records, emails, SMS, telephony minutes
  - Grand totals matching the invoice

Page 2+: Voice Record Detail
  - Table: Record Date | Member Name | Market | Call Duration | Processing Type | SOW Rate
  - Sorted by date ascending
  - Subtotal row

Page N: Text Record Detail
  - Same table format for text-only records (no STT transcription)
  - Subtotal row

Page N+1: Communication Detail
  - Emails sent: date, recipient, status
  - SMS sent: date, recipient, status

Page N+2: Telephony Detail
  - Platform-originated calls only (excluding imports)
  - Date | Duration | Agent

Final Page: Reconciliation Summary
  - Category totals matching invoice line items
  - Statement: "This report supports Invoice INV-XXXX-XXX"
```

### Technical approach

1. **New component**: `src/components/billing/UsageDetailPDFGenerator.ts`
   - Export a `generateUsageDetailPDF(periodStart, periodEnd, invoiceNumber?)` function
   - Fetches data directly from database (bookings + api_costs + contact_communications for the period)
   - Uses jsPDF (already installed) to render the multi-page report
   - Handles pagination automatically for large datasets

2. **Data queries** (inside the generator, called on-demand):
   - Bookings in period with agent name, market, call duration, transcription status
   - API costs joined to bookings to classify voice vs text
   - Contact communications for email/SMS counts
   - Platform-originated bookings (no `import_batch_id`) for telephony

3. **UI integration**: Add a "Download Usage Report" button on the Billing page's Costs tab or Invoice History, next to the existing PDF download button.

### Files to create/modify

| File | Change |
|------|--------|
| `src/components/billing/UsageDetailPDFGenerator.ts` | New — PDF generation logic |
| `src/components/billing/InvoiceHistory.tsx` | Add "Usage Report" download button per invoice |
| `src/pages/Billing.tsx` | Add standalone "Generate Usage Report" button on Costs tab |

### Key design decisions

- Reuses the same visual style (navy headers, zebra stripes, Appendify branding) as the existing invoice PDF for consistency
- Fetches data on-demand when the button is clicked (not pre-loaded) to avoid performance impact
- Limits to 5,000 records per query (matching existing billing data limits)
- Voice vs text classification uses the same logic already in `useBillingData`: a booking with an `stt_transcription` cost entry = voice; otherwise = text

