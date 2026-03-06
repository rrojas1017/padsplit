

## Problem: AI Output Schema Drift + Normalization Gaps

### Root Cause
The AI is ignoring the specified JSON schema and using different field names across runs. The normalization function we added only handles *some* variations but misses others that actually appear in the data:

| Expected Field | AI Actually Returns | Handled by Normalizer? |
|---|---|---|
| `booking_ids` | `case_ids` | **No** |
| `representative_quotes` | `key_quotes` | **No** |
| `frequency` | `case_count` | Yes |
| `cluster_description` | `description` | Yes |
| `representative_quotes` | `supporting_quotes` | Yes |

**Latest report (`a5e5e6e3`)**: Has `supporting_quotes` but no `booking_ids`, no `case_ids`, no `frequency`, no `case_count` — so normalization produces empty arrays and 0 counts.

**Report `d331bff9`**: Used `case_ids` (5 IDs present) but the normalizer doesn't map those to `booking_ids`.

**Report `cc137c2d`**: Had `case_count: 28` and `key_quotes` — the best structured one — but `key_quotes` aren't mapped.

### Fix

**File: `supabase/functions/generate-research-insights/index.ts`**

1. **Expand `normalizeInsightData()`** to handle all observed field name variations:
   - `case_ids` → `booking_ids`
   - `key_quotes` → `representative_quotes`  
   - `key_issues` as fallback for quotes if nothing else exists
   - `impact_quote` (string) → wrap into `representative_quotes` array

2. **Strengthen the synthesis prompt** — add an explicit "FIELD NAME REQUIREMENTS" section that lists the exact field names with a warning not to use alternatives like `case_ids`, `key_quotes`, `supporting_quotes`.

3. **Add `response_format: { type: 'json_object' }`** verification — already present but the schema instruction in the user prompt should repeat the exact field names one more time as a checklist.

These are targeted fixes to the normalizer and prompt. No UI changes, no structural changes to the report layout.

### Files to Edit
- `supabase/functions/generate-research-insights/index.ts` — expand normalizer + tighten synthesis prompt

