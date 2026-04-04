

# Automate Nightly Communication Insights + Word Export

## What Changes

1. **Nightly automation** — Add two pg_cron jobs (like the existing research insights nightly job) to auto-generate both Booking Insights and Non-Booking Insights every night at 10 PM EST (3 AM UTC), using the `allTime` analysis period
2. **Remove manual "Run Analysis" buttons** — Both tabs currently have a "Run Analysis" button that manually triggers the edge functions. These will be removed since generation is automated
3. **Add Word (.docx) executive export** — Create a new `generate-communication-insights-docx.ts` utility that produces a single Word document combining both Booking and Non-Booking insights (similar to the existing `generate-executive-docx.ts` for Move-Out research). Replace the current PDF export button with a Word export button

## Files

### New Files

| File | Purpose |
|------|---------|
| `src/utils/generate-communication-insights-docx.ts` | Word (.docx) generator combining Booking Insights (pain points, objections, sentiment, market breakdown, recommendations, customer journeys) and Non-Booking Insights (rejection reasons, missed opportunities, objection patterns, recovery recommendations) into one executive summary document |

### Modified Files

| File | Change |
|------|--------|
| `src/components/call-insights/BookingInsightsTab.tsx` | Remove "Run Analysis" button. Replace PDF export with Word (.docx) export button. Show "last generated" timestamp from most recent completed insight. Keep date range selector for filtering historical analyses |
| `src/components/call-insights/NonBookingAnalysisTab.tsx` | Remove "Run Analysis" button. Add Word (.docx) export button. Show "last generated" timestamp. Keep date range selector |
| `src/pages/CallInsights.tsx` | Add a top-level "Export Executive Summary" button that generates a combined Word doc from both the latest booking and non-booking insights for the selected period |

### Database (no schema changes)

Two new pg_cron jobs (inserted via `supabase--read_query` insert, not migration):

1. **Nightly Booking Insights** — `0 3 * * *` (10 PM EST) → calls `analyze-member-insights` with `{ analysis_period: "allTime", automated: true }`
2. **Nightly Non-Booking Insights** — `5 3 * * *` (10:05 PM EST, staggered by 5 min) → calls `analyze-non-booking-insights` with `{ analysis_period: "allTime", automated: true }`

## Technical Details

- The Word document follows the same structure as `generate-executive-docx.ts`: navy headers, KPI table, findings sections, recommendations
- Booking section includes: KPI summary (total calls, sentiment split), top pain points table, objection patterns, market breakdown, AI recommendations
- Non-Booking section includes: KPI summary (total non-booking calls, avg duration), rejection reasons table, missed opportunities, recovery recommendations
- Both edge functions already accept `analysis_period` and date range params — no backend changes needed
- The existing `memberInsightsPDF.ts` (jsPDF) export will be replaced by the new `.docx` export
- Lazy-load the docx generator in the tabs to avoid bundle bloat

