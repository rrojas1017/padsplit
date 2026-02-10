

# Fix: Invoice Generator Period Dates Should Drive Data

## Problem
The Invoice Generator has its own "Period Start" and "Period End" date pickers, but they are purely cosmetic. The line items and record counts are driven by the **billing page's global date filter** (top-right dropdown, defaulting to "Today"). If there are no records processed today, nothing shows up regardless of what period you select in the invoice form.

## Solution
Make the Invoice Generator self-sufficient: when you select a period and a client, it fetches record counts for that specific date range and builds line items accordingly.

## Changes

### 1. Add a dedicated data-fetch function in `useBillingData.ts`
Create a new function `fetchPeriodCounts(startDate, endDate)` that:
- Queries `bookings` within the date range to get booking IDs
- Queries `api_costs` for those bookings to classify voice vs. text vs. coaching records
- Queries `contact_communications` for email/SMS counts in that period
- Returns `{ voiceRecordCount, textRecordCount, voiceCoachingCount, emailDeliveryCount, smsDeliveryCount, telephonyMinutes, totalInternalCost }`

### 2. Update `InvoiceGenerator.tsx`
- Remove the props for `voiceRecordCount`, `textRecordCount`, etc.
- Instead, accept a `fetchPeriodCounts` prop (or call it internally)
- When the user changes period dates or selects a client, trigger a fetch for that specific period
- Show a loading state while fetching
- Populate line items from the fetched period data (not the global summary)

### 3. Update `Billing.tsx`
- Pass `fetchPeriodCounts` from the hook instead of individual count props
- Remove the static count props from the InvoiceGenerator usage

### 4. Client Enabled Services
- Update the PadSplit client to include all relevant services (voice_coaching, email_delivery, sms_delivery, etc.) so line items appear when there's matching data
- Alternatively, show all services with data regardless of enabled_services (with a note if not in the client's SOW)

## Technical Details

### New function in `useBillingData.ts`
```typescript
const fetchPeriodCounts = async (start: string, end: string) => {
  // 1. Get bookings in range
  // 2. Get api_costs for those bookings
  // 3. Classify: voice (has stt_transcription), text (no STT), coaching (tts_coaching)
  // 4. Get communication counts from contact_communications
  // 5. Return counts + totalInternalCost
};
```

### Files Modified
- `src/hooks/useBillingData.ts` -- Add `fetchPeriodCounts` function
- `src/components/billing/InvoiceGenerator.tsx` -- Fetch data on period change instead of using static props
- `src/pages/Billing.tsx` -- Simplify InvoiceGenerator props

