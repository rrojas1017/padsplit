

## Fix Reason Code Drill-Down: Match Records to Aggregated Categories

### Problem
The drill-down shows "0 matching records" because it tries to match the **aggregated category name** (e.g., "Positive, Planned & Unavoidable Churn") against individual record `primary_reason_code` values (e.g., "GRADUATION", "Positive Move-On", "Life Event"). These are at different levels of abstraction — the AI groups dozens of granular codes into ~6 high-level categories during report generation, but doesn't store the mapping.

### Solution — No reprocessing needed
Fix the `ReasonCodeDrillDown` component to use **semantic keyword matching** against known category themes, and also match against the record's `research_classification` fields more broadly (e.g., `primary_reason_code`, `reason_code`, `root_cause_summary`).

### Implementation

#### Update `ReasonCodeDrillDown.tsx`
Replace the current fuzzy match with a **category-to-keywords mapping** approach:

1. Define keyword sets for each known category:
   - "Positive, Planned & Unavoidable Churn" → matches codes containing: graduation, positive, life event, personal, external, planned, found other, found better, relocation, moving
   - "Host & Property Quality Failures" → property, host, maintenance, safety, habitability, pest, mold, conditions
   - "Financial Hardship & Payment Issues" → financial, payment, afford, hardship, billing, cant afford
   - "Roommate Conflict & Safety" → roommate, conflict, assault, threat
   - "Platform, Process & Policy Failures" → platform, process, policy, bug, house rules, support
   - "Other / Unknown" → other, unknown, unresponsive

2. When a category is clicked, extract keywords from the category name and description, then match records whose `primary_reason_code` OR `root_cause_summary` contains any of those keywords.

3. Additionally, also include the report's `by_category` description text in the matching context to improve accuracy.

#### Also update the prompt (optional enhancement)
Modify the aggregation prompt in `generate-research-insights/index.ts` to include `booking_ids` in each `by_category` entry, so future reports have a precise mapping. This is a forward-looking fix — the keyword matching handles existing reports.

### Files changed
- `src/components/research-insights/ReasonCodeDrillDown.tsx` — replace fuzzy matching with category-aware keyword matching
- `supabase/functions/generate-research-insights/index.ts` — add `booking_ids` array to `by_category` schema and pass booking IDs to the AI

