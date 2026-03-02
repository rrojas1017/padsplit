

## Exclude TTS (Jeff & Katty) from Client Billing

### Context
Currently, the billing system counts TTS coaching audio generation (Jeff and Katty) as a separate billable SOW line item ("Voice Feedback, QA & Sales Coaching" at $0.55/record). You want to stop billing clients for TTS — only charge for transcriptions and AI processing.

### Changes Required

**1. Remove `voice_coaching` from SOW pricing and invoice generation**

In `src/utils/billingCalculations.ts`:
- Remove the `voice_coaching` entry from the `SOW_PRICING` constant
- Remove the corresponding label from `SOW_CATEGORY_LABELS`

**2. Remove voice coaching count from invoice line items**

In `src/components/billing/InvoiceGenerator.tsx`:
- Remove the `voice_coaching` entry from the `quantityMap` (line 94)
- Remove `voiceCoachingCount` from the `cost_breakdown` object

**3. Remove voice coaching from the CostOverviewCards billable calculation**

In `src/components/billing/CostOverviewCards.tsx`:
- Remove the `summary.voiceCoachingCount * getRate('voice_coaching')` line from the billable total calculation

**4. Remove voice coaching row from invoice PDF**

In `src/components/billing/InvoicePDFGenerator.tsx`:
- Remove the `voice_coaching` entry from the PDF line items config (line 39)

**5. Stop counting voice coaching in period data**

In `src/hooks/useBillingData.ts`:
- Remove the `coachingIds` / `voiceCoachingCount` logic from both the summary classification (lines 198-200) and the `fetchPeriodCounts` function (line 384, 406)
- Set `voiceCoachingCount` to `0` (or remove the field) so no coaching records are billed

**6. Deactivate `voice_coaching` SOW pricing row in the database**

Update the `sow_pricing_config` table to set `is_active = false` for the `voice_coaching` row, so it no longer appears in the SOW Pricing tab or invoice previews.

### What stays the same
- TTS costs will still be **tracked** internally in the `api_costs` table for cost monitoring
- The Realtime Cost Dashboard will still show TTS costs for internal visibility
- Only the client-facing billing/invoicing excludes TTS

