

# Fix: Market Intelligence Record Count Gap and City Name Normalization

## Problem
1. **Record count mismatch**: Reports shows 127 bookings but Market Intelligence shows 114 because the "Min Records" filter (set to 3) hides 13 records spread across 59 low-volume cities.
2. **Duplicate cities**: AI-extracted city names have inconsistent casing and spelling (e.g., "austin" vs "Austin", "College Park" vs "college park", "desoto" vs "De Soto"), fragmenting data that should be grouped together.

## Plan

### 1. Normalize City/State Names in the Edge Function
In `supabase/functions/aggregate-market-data/index.ts`, normalize city and state names before aggregation:
- Convert to title case (e.g., "austin" becomes "Austin")
- Trim whitespace
- Handle known variations (e.g., strip neighborhood prefixes like "Northline, Houston" to "Houston")

This ensures records for the same city are grouped together, increasing per-city counts and reducing the number filtered out by the min records threshold.

### 2. Add a Helpful Message When Records Are Filtered
In `src/pages/MarketIntelligence.tsx`, show an info note when the displayed total is less than the actual total, explaining that some records are hidden by the min records filter.

Example: "Showing 114 of 127 records. 13 records in low-volume markets are hidden by the min records filter (set to 3)."

### 3. Backfill Existing Data (Optional Database Migration)
Create a one-time migration to normalize existing `market_city` and `market_state` values in the `bookings` table so future aggregations are consistent even without edge function normalization.

## Technical Details

### Edge Function Changes (`aggregate-market-data/index.ts`)
- Add a `normalizeCity(name)` helper that:
  - Trims whitespace
  - Converts to title case
  - Strips neighborhood prefixes (text before commas)
- Apply to `market_city` and `market_state` before building the aggregation maps
- Estimated: ~15 lines added

### Page Changes (`MarketIntelligence.tsx`)
- Compare total records from `stateData` sum vs. a new `rawTotal` field from the edge function
- Display a small info badge when records are hidden
- Estimated: ~5 lines added

### Database Migration
- `UPDATE bookings SET market_city = initcap(trim(market_city)), market_state = upper(trim(market_state))` to normalize existing data
- Handle comma-separated city names (e.g., "Northline, Houston" to "Houston")

### Files Modified
- `supabase/functions/aggregate-market-data/index.ts` -- add city normalization
- `src/pages/MarketIntelligence.tsx` -- add filtered records info message
- New migration -- normalize existing city/state data

