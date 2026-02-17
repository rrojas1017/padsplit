

## Fix Backfill Pricing Function Issues

### Problems Found

1. **Dry-run mode broken**: When the page loads, it calls `backfill-pricing-data` with `batchSize: 0` to get the count of missing records. But the function still processes records because `batchSize` only controls the SQL `.limit()` -- passing 0 causes unexpected behavior (it processed 5 records on what should have been a count-only call).

2. **JSON parsing failures (~5-10%)**: The AI sometimes returns malformed JSON (unterminated strings), causing `SyntaxError` and skipping those records. The current cleanup only handles markdown fences but doesn't handle other common issues.

3. **React key warning**: The `StateHeatTable` component has a missing `key` prop on list items (unrelated but visible in console).

### Fixes

**1. Add dry-run support to `backfill-pricing-data` edge function**
- When `batchSize` is 0, skip processing and only return the `remaining` count
- This prevents accidental processing on page load

**2. Improve JSON parsing resilience**
- Add a regex-based extraction fallback: if `JSON.parse` fails, try to extract the JSON object using a regex pattern `\{[\s\S]*\}`
- Add `response_format` hint to the AI prompt asking for strict JSON

**3. Fix StateHeatTable key warning**
- Add unique `key` props to the list items in StateHeatTable that are missing them

### Technical Details

**File: `supabase/functions/backfill-pricing-data/index.ts`**
- Add early return when `batchSize === 0`: query only for the count, skip AI processing
- In `extractPricingFromTranscription`, add fallback JSON extraction after parse failure:
  ```typescript
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Fallback: try to extract JSON object via regex
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else return null;
  }
  ```

**File: `src/components/market-intelligence/StateHeatTable.tsx`**
- Identify and add missing `key` props on rendered list elements

