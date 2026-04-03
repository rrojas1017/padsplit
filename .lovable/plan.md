

# STEP 15 — Fix Audience Survey Insights Dashboard: Clean Up & Simplify

## Changes

### 1. `src/pages/research/ResearchInsights.tsx` — Hide move-out UI for audience survey

**Lines 288-298** (Campaign selector dropdown): Wrap in `{!isAudienceSurvey && (...)}`

**Lines 350-367** (Report version selector): Wrap in `{!isAudienceSurvey && (...)}`

**Lines 370-415** (Processing stats banner + flagged for review card): Wrap entire block in `{!isAudienceSurvey && (...)}`

This leaves only the campaign type selector (line 274-286) and date range filter (line 300-311) visible for audience survey.

### 2. `src/utils/audienceSurveyInsights.ts` — Add `formatLabel()` + `capSlices()`

Add two utility functions:
- **`formatLabel(raw)`**: Lookup table for known raw values (snake_case → human-readable), fallback converts `snake_case` to Title Case
- **`capSlices(data, max=6)`**: Groups items beyond `max` into an "Other" bucket

### 3. `src/components/audience-survey/AudienceSurveyInsightsDashboard.tsx` — Fix KPI

Replace the `questions_covered_estimate` calculation (lines 77-81) with a function that counts non-null extraction fields per record. The survey has 13 core questions (Q1-Q13, excluding conditional Q14-Q16). For each record, count how many extraction sections have data. Average across all records. Display as `"X / 13"`.

Rename KPI label from "Avg Questions Covered" to "Avg Qs Answered".

Apply `formatLabel()` to `topPlatform`, `topMotivator` in KPI values, and to badge labels in the overview tab scroll-stoppers.

### 4. `src/components/audience-survey/CreativeStrategy.tsx` — Cap pie slices + format labels

- Apply `capSlices()` to `detailPref` before rendering pie chart
- Apply `formatLabel()` to all labels in both charts
- Change Legend to `layout="vertical" align="right" verticalAlign="middle"` to prevent horizontal overflow

### 5. `src/components/audience-survey/MessagingMatrix.tsx` — Format labels

- Apply `formatLabel()` to trigger labels (line 47), motivator chart labels (line 19-22), and heatmap row/column headers (lines 109, 116)

### 6. `src/components/audience-survey/BarrierAnalysis.tsx` — Format labels

- Apply `formatLabel()` to butterfly chart labels (line 29), confusion point labels (line 105), and barrier mapping table cells (lines 142-143)

### 7. `src/components/audience-survey/PlatformGapChart.tsx` — Format labels

- Apply `formatLabel()` to platform names in chart data (line 15)

### 8. `src/components/audience-survey/AdExposureDonut.tsx` — No changes needed

Labels are already hardcoded human-readable strings ("Saw & Liked", "Haven't Seen", etc.), not from raw DB values.

### Files
| File | Change |
|------|--------|
| `src/pages/research/ResearchInsights.tsx` | Hide campaign dropdown, report version selector, processing banner, flagged card for audience survey |
| `src/utils/audienceSurveyInsights.ts` | Add `formatLabel()` and `capSlices()` utilities |
| `src/components/audience-survey/AudienceSurveyInsightsDashboard.tsx` | Fix Avg Qs KPI (count non-null fields), apply `formatLabel()` to KPI values and badges |
| `src/components/audience-survey/CreativeStrategy.tsx` | Cap pie to 6 + Other, format labels, fix Legend layout |
| `src/components/audience-survey/MessagingMatrix.tsx` | Format labels in triggers, motivators, heatmap |
| `src/components/audience-survey/BarrierAnalysis.tsx` | Format labels in butterfly chart, confusion, mapping table |
| `src/components/audience-survey/PlatformGapChart.tsx` | Format platform labels |

