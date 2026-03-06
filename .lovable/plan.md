

## Fix Issue Clusters: Schema Compliance in Synthesis Step

### Problem
The issue clusters returned by the AI don't match the expected schema. The synthesis step (line 296) passes chunk results with a generic "Synthesize these batch results" instruction, causing the AI to return a simplified structure with wrong field names and missing quantitative data:

**What the AI returns:**
```json
{
  "cluster_name": "P0: Host Negligence",
  "description": "...",
  "priority": "P0",
  "supporting_quotes": ["..."],
  "recommended_action": "string"
}
```

**What the UI expects:**
```json
{
  "cluster_name": "Host Negligence",
  "cluster_description": "...",
  "frequency": 28,
  "pct_of_total": 26.7,
  "booking_ids": ["uuid1", ...],
  "reason_codes_included": ["..."],
  "severity_distribution": { "critical": 5, "high": 10, ... },
  "representative_quotes": ["..."],
  "systemic_root_cause": "...",
  "recommended_action": { "action": "...", "owner": "...", "priority": "P0", "effort": "medium", ... }
}
```

This means the UI shows clusters with no case counts, no quotes, no severity badges, no root cause, and no structured recommendations — making them essentially useless.

### Fix

**File: `supabase/functions/generate-research-insights/index.ts`**

1. **Improve the synthesis prompt** (line 296): Include the full JSON schema in the synthesis call so the AI knows the exact structure to produce. Also pass the original raw record summaries so the AI can compute accurate `booking_ids`, `frequency`, and `pct_of_total` values.

2. **Add schema validation/normalization** after parsing the final result: A small function that checks each issue cluster and normalizes field names (e.g., `description` → `cluster_description`, `supporting_quotes` → `representative_quotes`), and ensures `recommended_action` is an object, not a string.

3. **Strip priority prefixes from cluster names**: The AI is embedding priority in the name ("P0: Host Negligence"). The name should be descriptive only; priority belongs in `recommended_action.priority`.

### Changes

**`supabase/functions/generate-research-insights/index.ts`:**
- Add a `normalizeIssueClusters()` function that fixes field names and structure
- Update the synthesis call (line ~296) to include the schema template and original record data
- Apply normalization to `finalResult.issue_clusters` before storing

### Expected Result
After the fix, issue clusters will display with proper case counts, severity badges, representative quotes, root cause analysis, and structured action items — making them actionable for the user.

