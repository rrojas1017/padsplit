

## Fix Research Insights UI Issues

### Problems Identified (from live inspection)

1. **Reason Code Chart is 132 entries tall (~6600px)** — The backend's `programmaticMerge` doesn't consolidate duplicate reason codes across chunks. Categories like "Job Relocation" and "External Circumstances - Job Relocation" remain separate. Raw enum codes like "MAINTENANCE_UNINHABITABLE" mix with readable names.

2. **Executive Summary uses a full paragraph as the title** — The AI returned `headline` as a long paragraph (identical to `key_findings`) and no `title` field. The component renders this paragraph in the hero banner title AND repeats it as body text. The `date_range` is "not specified".

3. **No summary stat cards** — `total_cases`, `preventable_churn`, `unpreventable_churn` are all 0 in the executive summary, so the stat tiles don't appear.

### Plan

#### 1. Fix ReasonCodeChart.tsx — Cap at top 15, group rest as "Other"
- After sorting, take top 15 entries and aggregate the remainder into a single "Other" entry
- This prevents the chart from being 6600px tall
- Chart height becomes manageable (~750px)

#### 2. Fix ExecutiveSummary.tsx — Handle missing title gracefully
- If `title` is missing and `headline` is longer than 120 characters, use a generic title like "Research Insights Summary" and treat `headline` as body text only
- If `headline` equals `key_findings`, don't show both — show body text once
- Hide the period badge if value is "not specified" or empty

#### 3. Fix programmaticMerge in edge function — Consolidate duplicate reason codes
- When merging `reason_code_distribution` arrays across chunks, normalize the `code`/`category` key (lowercase, trim, collapse synonyms like "Job Relocation" / "External Circumstances - Job Relocation")
- Sum counts for matching codes and recalculate percentages based on the total
- Limit final output to top 20 categories plus "Other"
- Also map raw enum codes (e.g., "MEMBER_FINANCIAL_HARDSHIP") to readable labels

### Files to edit
- `src/components/research-insights/ReasonCodeChart.tsx` — Add top-15 grouping
- `src/components/research-insights/ExecutiveSummary.tsx` — Fix title/body duplication
- `supabase/functions/generate-research-insights/index.ts` — Fix reason code consolidation in `programmaticMerge`

