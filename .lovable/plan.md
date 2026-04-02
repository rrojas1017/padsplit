

# Filter Audience Survey Records by Minimum Question Coverage

## Problem
Currently, all audience survey records with `has_valid_conversation = true` are included in reports and insights — even if the call barely covered any survey questions. The move-out survey pipeline already filters by conversation validity; the audience survey needs an equivalent "at least 1 question answered" gate.

## Current data
- 35 audience survey records, all with `has_valid_conversation = true`
- `survey_progress.answered` ranges from 2 to 12
- The `research_extraction` also contains `agent_observations.questions_covered_estimate`

## Approach
Add a **minimum questions threshold** check (≥ 1 answered question) in three places:

### 1. `src/hooks/useReportsData.ts`
When `campaignTypeFilter === 'audience_survey'`, after fetching records, filter out any where `survey_progress.answered < 1` (or `survey_progress` is null). This is already client-side post-fetch filtering since `survey_progress` comes from the joined `booking_transcriptions`.

### 2. `supabase/functions/generate-research-insights/index.ts`
In the audience survey aggregation path (around line 1077), add a filter: skip records where `survey_progress.answered < 1`. This ensures the AI aggregation only uses records with real data.

### 3. `src/hooks/useReasonCodeCounts.ts` (move-out only — no change needed)
Already filters by `research_campaign_type = 'move_out_survey'`, so audience survey records are excluded.

### 4. Reports page — Campaign column display
In the campaign badge column (from the plan you just approved), show a warning indicator for audience survey records with very low question coverage (e.g. < 3 answered) so admins can spot thin data.

## Technical details

| File | Change |
|------|--------|
| `src/hooks/useReportsData.ts` | Post-fetch filter: exclude audience survey records with `survey_progress.answered < 1` |
| `supabase/functions/generate-research-insights/index.ts` | Add `survey_progress.answered >= 1` filter for audience survey records before aggregation |
| `src/pages/Reports.tsx` | Show "thin data" indicator on audience survey rows with < 3 questions answered |

## Notes
- Threshold of **≥ 1** is the minimum gate (at least one question was answered)
- Currently the lowest in the dataset is 2, so no records would be excluded today — but this protects against future bad data
- The move-out survey equivalent is `has_valid_conversation` which is already enforced everywhere

