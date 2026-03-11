

## What Happened

The previous SQL migration (step 5) was supposed to convert `reason_code_distribution` from an object map `{"Payment": {...}, "Host Issue": {...}}` to an array format. However, the values in the map were **nested JSON objects** (not plain integers), so the regex check `kv.value ~ '^\d+$'` failed for every entry, defaulting all counts to `0`. This is why the chart shows "0%" everywhere.

The blind spots, host accountability, emerging patterns, and executive summary data are all intact and rendering correctly. The **only broken piece** is the reason code distribution chart.

Since the original data was overwritten by the migration and no `_chunks` backup exists, the counts cannot be recovered from this report.

## Fix Plan

**1. Delete the corrupted report and regenerate**
- The older report (`e6d4fc4f`, 114 records, proper data) still works perfectly
- Delete or mark the corrupted report `8f806a9f` as failed so the UI falls back to the older one
- Then regenerate a fresh report which will produce clean data through the now-hardened pipeline

**2. Fix the edge function's normalizeChunkResult to prevent this in future**
- When `reason_code_distribution` is an object map with nested object values (not just integers), extract the `count` field from each nested object properly
- This ensures the programmatic merge always produces valid array-format output

**Files to edit:**
- `supabase/functions/generate-research-insights/index.ts` — improve reason code normalization for nested object values
- Database: mark report `8f806a9f` as `failed` so the UI shows the working older report immediately

This is a data-recovery + prevention fix, not a UI redesign. The UI components are correct and rendering properly when given valid data.

