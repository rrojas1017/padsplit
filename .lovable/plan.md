

## Fix: Invoice vs Detail Report Record Count Mismatch

### Root cause (two bugs)

**Bug 1 -- Missing `record_type` filter on invoice counts.**
`fetchPeriodCounts` in `useBillingData.ts` queries all bookings in the period without excluding research records. The Records Processing Detail report correctly filters `.neq('record_type', 'research')`. So the invoice may be billing for research records that the detail report omits.

**Bug 2 -- Different join strategy for `api_costs`.**
- Invoice (`fetchPeriodCounts`): fetches bookings by `booking_date`, then fetches `api_costs` by `.in('booking_id', periodBookingIds)` -- correct approach, anchored to the booking date.
- Detail report (`RecordsProcessingPDFGenerator`): fetches `api_costs` by `created_at` timestamp range, which may not align with the booking's `booking_date`. A call booked on Jan 31 but transcribed on Feb 2 would show in the invoice (anchored to booking_date) but the cost entry might not match the detail report's `created_at` filter.

### Fix

**1. `src/hooks/useBillingData.ts` -- `fetchPeriodCounts`**
- Add `.neq('record_type', 'research')` to the bookings query so research records are excluded from invoice totals.

**2. `src/components/billing/RecordsProcessingPDFGenerator.ts` -- `fetchProcessingData`**
- Change `api_costs` query from filtering by `created_at` date range to filtering by `.in('booking_id', bookingIds)` -- matching the invoice's approach of anchoring everything to booking_date.

**3. `src/components/billing/UsageDetailPDFGenerator.ts` -- `fetchUsageData`**
- Same fix: change `api_costs` query from `created_at` range to `.in('booking_id', bookingIds)`.

### Result
All three surfaces (invoice total, usage detail report, records processing report) will use the same data: bookings filtered by `booking_date` + `record_type != research`, with costs joined by `booking_id`.

