

# Fix Dashboard Cost Breakdown Accuracy

## Problem

The Cost Breakdown section on the Dashboard is misleading because:

1. **QA coaching generation costs ($0.14 TTS + $0.003 script gen) appear as "booking processing" costs** — a super_admin manually triggered QA coaching audio for an old Feb 11 booking (Nicholas Jackson), but it shows as "1 booking processed at $0.1429/each" on today's dashboard.

2. **The `is_internal` flag was not set** on these costs even though a super_admin triggered them — the `generate-qa-coaching-audio` edge function may not be correctly detecting internal usage.

3. **TTS coaching costs distort the "Per Booking" average** — mixing $0.14 TTS costs with $0.05 transcription costs makes the per-booking metric unreliable for cost monitoring.

## Root Cause

The dashboard's `useBillingData` hook fetches ALL non-internal `api_costs` by `created_at`. It doesn't distinguish between:
- **Core pipeline costs** (STT, AI analysis, QA scoring) — the actual cost of processing a booking
- **Optional add-on costs** (TTS coaching audio, QA coaching audio) — manually triggered, expensive, and not representative of per-record cost

## Proposed Fix (Two Parts)

### Part 1: Exclude TTS costs from the dashboard Cost Breakdown

The dashboard Cost Breakdown should show **core processing costs only** (what it costs to process a booking), not optional TTS coaching generation. This matches how the Cost Alert Monitor already works — it excludes `tts_%` service types.

**File: `src/hooks/useBillingData.ts`**

In the `fetchData` function, after fetching `costsRaw`, filter out TTS-related service types before setting state:

```typescript
// Filter out TTS coaching costs for dashboard summary — these are optional
// add-ons, not core processing costs. Matches cost alert monitor behavior.
costsData = (costsRaw || []).filter(
  (c: any) => !c.service_type?.startsWith('tts_') && c.service_type !== 'qa_script_generation'
);
```

This means the dashboard will show the actual cost of processing bookings (STT + AI analysis + QA scoring), giving an accurate "Per Booking" metric.

### Part 2: Fix `is_internal` flagging on QA coaching generation

**File: `supabase/functions/generate-qa-coaching-audio/index.ts`**

Verify and fix the logic that checks whether the requesting user is a super_admin and sets `is_internal: true` on the `api_costs` insert. The two cost records for booking `57cf6b62` today were logged with `is_internal: false` despite being triggered by a super_admin — this suggests the identity resolution is failing or missing in this function.

### Part 3: Add an `excludeTTS` option to `useBillingData` (optional, cleaner approach)

Rather than always filtering TTS costs, add a parameter so the Dashboard can exclude them while the Billing page still shows all costs:

```typescript
export function useBillingData(
  dateRange: DateRangeType = 'thisMonth',
  customStart?: Date,
  customEnd?: Date,
  options?: { excludeTTS?: boolean }
)
```

The Dashboard would call `useBillingData(..., { excludeTTS: true })` while the Billing page continues to show everything.

## Impact

- Dashboard "Per Booking" metric will accurately reflect core processing cost (~$0.05) instead of being inflated by TTS ($0.14)
- "Bookings processed" count will only reflect bookings that went through the transcription/analysis pipeline
- The full Billing page remains unchanged — all costs including TTS are still visible there
- No database changes needed

## Technical Details

| Metric | Current (wrong) | After fix |
|---|---|---|
| Total Cost (today) | $0.1429 | $0.00 (no core processing today) |
| Bookings Processed | 1 | 0 |
| Per Booking | $0.1429 | — (no bookings) |
| Talk Time | 0m | 0m |

