

## Campaign-Aware Research Pipeline

### Problem
The entire research pipeline (extraction, aggregation, UI) is hardcoded for Move-Out Survey logic. The new Audience Survey produces completely different data (multiple-choice marketing questions vs open-ended churn analysis) but gets forced through the same prompts and UI, producing nonsensical results.

### Architecture

```text
┌─────────────────────┐
│  Call comes in       │
│  (transcribed)       │
└─────────┬───────────┘
          ▼
┌─────────────────────────────────┐
│ process-research-record         │
│  1. Detect campaign type        │
│     (script_id → campaign_type) │
│  2. Select correct prompt       │
│  3. Extract + classify          │
│  4. Store with campaign_type    │
└─────────┬───────────────────────┘
          ▼
┌─────────────────────────────────┐
│ generate-research-insights      │
│  1. Filter by campaign_type     │
│  2. Use correct agg prompt      │
│  3. Store with campaign_type    │
└─────────┬───────────────────────┘
          ▼
┌─────────────────────────────────┐
│ UI: ResearchInsights page       │
│  Campaign switcher dropdown     │
│  → Move-Out Dashboard (existing)│
│  → Audience Survey Dashboard    │
└─────────────────────────────────┘
```

### Implementation Steps

#### Step 1: Database Migration
Add `research_campaign_type` column to `booking_transcriptions` and `campaign_type` column to `research_insights`:

- `ALTER TABLE booking_transcriptions ADD COLUMN research_campaign_type text DEFAULT 'move_out_survey'`
- `ALTER TABLE research_insights ADD COLUMN campaign_type text DEFAULT 'move_out_survey'`
- Backfill all existing processed records as `move_out_survey`
- Add index on `research_campaign_type`

#### Step 2: Update `process-research-record` Edge Function
- Add campaign detection logic inline (lookup `research_scripts` by `research_call_id` on the booking, match `campaign_type` field)
- Add audience survey extraction prompt (extracts: platform preferences, ad awareness, content preferences, first impressions, audience segment)
- Keep existing move-out prompt as default
- Store `research_campaign_type` alongside extraction results

#### Step 3: Update `generate-research-insights` Edge Function
- Accept `campaign_type` parameter
- Filter records by `research_campaign_type`
- Add audience survey aggregation prompt (aggregates: platform breakdown, ad awareness stats, content preferences, audience segments, marketing recommendations)
- Store `campaign_type` on the insight record

#### Step 4: Update Types (`src/types/research-insights.ts`)
Add new interfaces for audience survey data:
- `AudienceSurveyData` (platform_breakdown, ad_awareness, content_preferences, first_impressions, audience_segments, recommendations)
- Update `ResearchInsightData` to be a union or have a `campaign_type` discriminator

#### Step 5: Update Hook (`useResearchInsightsData.ts`)
- Accept `campaignType` parameter
- Filter queries by campaign type
- Pass campaign type to `generateReport`

#### Step 6: Create Audience Survey UI Components (10 new files)
All in `src/components/audience-survey/`:

| Component | Purpose |
|---|---|
| `AudienceSurveyDashboard.tsx` | Main 3-tab layout for audience data |
| `AudienceSurveyExecutiveSummary.tsx` | Headline + key findings |
| `AudienceSurveyKPIRow.tsx` | 5 KPI cards (responses, platforms, ad awareness, etc.) |
| `PlatformBreakdownChart.tsx` | Horizontal bar chart of social media usage |
| `AdAwarenessPanel.tsx` | PadSplit ad awareness pie + where they expected ads |
| `RankedItemsTable.tsx` | Reusable ranked table (for preferences, concerns) |
| `AdPreferencesPanel.tsx` | Ad detail preferences + content type preferences |
| `FirstImpressionsPanel.tsx` | Concerns, interest drivers, confusion points |
| `AudienceSegmentsPanel.tsx` | Segment cards with key traits |
| `RecommendationsPanel.tsx` | Marketing recommendations with priority badges |

#### Step 7: Create Move-Out Dashboard Wrapper
- `src/components/research-insights/MoveOutDashboard.tsx` — wraps all existing components (ExecutiveSummary, TopActions, ReasonCode, etc.) in a clean component the main page can render

#### Step 8: Update Main Page (`ResearchInsights.tsx`)
- Add campaign type switcher (Move-Out Research / Audience Survey)
- Route to correct dashboard based on selection
- Pass campaign type to hook and report generation

### Files Changed Summary

| # | File | Action |
|---|---|---|
| 1 | Migration SQL | NEW — add columns + indexes |
| 2 | `supabase/functions/process-research-record/index.ts` | MODIFY — add campaign detection + audience prompt |
| 3 | `supabase/functions/generate-research-insights/index.ts` | MODIFY — filter by campaign, add audience agg prompt |
| 4 | `src/types/research-insights.ts` | MODIFY — add audience survey types |
| 5 | `src/hooks/useResearchInsightsData.ts` | MODIFY — accept campaignType param |
| 6-15 | `src/components/audience-survey/*.tsx` | NEW — 10 components |
| 16 | `src/components/research-insights/MoveOutDashboard.tsx` | NEW — wrapper |
| 17 | `src/pages/research/ResearchInsights.tsx` | MODIFY — campaign switcher |

### Technical Notes
- Campaign detection priority: `research_call_id` → script's `campaign_type` → transcript keyword heuristics → default `move_out_survey`
- Audience survey extraction schema is quantitative (counts, selections) vs move-out's qualitative (narratives, scores)
- All existing move-out data is preserved — this is additive
- Edge functions inline all prompts (Deno can't import from `src/`)

