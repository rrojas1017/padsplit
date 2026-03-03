

## Records Processing Detail Report

A new standalone PDF report that lists every record processed during a billing period with a breakdown of **what processing was performed** on each one -- not just "Voice" or "Text" classification, but the actual services applied (transcription, AI analysis, QA scoring, coaching audio, etc.).

### How it differs from the existing Usage Detail Report

| Existing Usage Detail Report | New Processing Detail Report |
|-----|-----|
| Groups records by Voice vs Text | Lists ALL records in one table |
| Shows SOW rate per record | Shows which services were applied to each record |
| Billing-focused (rates, subtotals) | Evidence-focused (what was done) |
| Summary + reconciliation pages | Per-record processing breakdown |

### Report structure

```text
Page 1: Cover
  - "Records Processing Detail Report"
  - Appendify → PadSplit header
  - Period, generation date
  - Summary stats: total records, with transcription, with QA, with coaching

Page 2+: Processing Detail Table (landscape)
  - # | Date | Member | Market | Agent | Duration | Transcribed | AI Analysis | QA Scored | Coaching | Classification
  - Each processing step shown as ✓ or — 
  - Derived from api_costs entries linked to each booking

Final Page: Processing Summary
  - Count of records by processing type
  - Total records with each service applied
```

### Data approach

Query `api_costs` grouped by `booking_id` and `service_type` to build a map of which services were applied to each booking. Join with `bookings` for record metadata. Also pull from `booking_transcriptions` for transcription/QA/coaching status.

### Files

| File | Change |
|------|--------|
| `src/components/billing/RecordsProcessingPDFGenerator.ts` | **New** -- generates the processing detail PDF |
| `src/components/billing/InvoiceHistory.tsx` | Add a third download button for this report |

### Technical details

- New generator: `generateRecordsProcessingPDF(periodStart, periodEnd, invoiceNumber?)`
- Fetches `bookings` (non-research) + `api_costs` grouped by booking_id + `booking_transcriptions` for status flags
- Uses landscape orientation for wider table
- Same visual style (navy headers, zebra rows, Appendify branding)
- Processing columns derived from `service_type` values in `api_costs`: `stt_transcription`, `ai_analysis`, `ai_coaching`, `ai_qa_scoring`, `tts_coaching`, `tts_qa_coaching`

