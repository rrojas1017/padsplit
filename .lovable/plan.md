

## Fix: Drill-Down Showing 0 Records for Existing Reports

### Problem
Clicking "Host, Property & Safety Failures" (44 records) opens the drill-down but shows **0 records**. This happens because:
1. The current report was generated **before** `booking_ids` and `reason_codes_included` were added to the schema — so both are `undefined`
2. The fallback query in `ReasonCodeDrillDown` only runs when `reasonCodesIncluded` has values — which it doesn't for old reports
3. No third fallback exists

### Solution
Add a third fallback strategy to `ReasonCodeDrillDown.tsx` that uses the **group name** to fuzzy-match records:

1. When both `bookingIds` and `reasonCodesIncluded` are empty/missing, query all processed research records and filter client-side by matching the `primary_reason_code` against keywords extracted from the group name (e.g., "Host", "Property", "Safety")
2. This ensures old reports still work while new reports use the precise `booking_ids` path

### Files to Change

**`src/components/research-insights/ReasonCodeDrillDown.tsx`**
- Add Strategy 3 after Strategy 2: when no `bookingIds` and no `reasonCodesIncluded`, fetch all processed research records (with campaign/date filters) and fuzzy-match using the `groupName` split into keywords against each record's `primary_reason_code`
- Extract keywords by splitting group name on common delimiters (commas, "&", "and") and trimming filler words

This is a single-file change that makes the existing drill-down work retroactively for all previously generated reports.

