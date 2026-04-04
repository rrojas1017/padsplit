

# Move Script Results into Research Insights + Dynamic Script Discovery

## Problem
Script results currently live at `/research/scripts/:id/results` — a separate page accessed from the Script Builder. This is unintuitive. All research results should live in the **Research Insights** section, which already hosts Move-Out Research and Audience Survey. The Script Builder should only be for building scripts, not viewing results.

## Solution
Add each active script as a selectable option in the Research Insights campaign type dropdown. When selected, render the script's results dashboard inline — same pattern as how "Audience Survey" renders `AudienceSurveyInsightsDashboard`.

## Changes

### 1. `src/types/research-insights.ts`
- Expand `CampaignType` to include `script:{scriptId}` pattern:
  ```typescript
  export type CampaignType = 'move_out_survey' | 'audience_survey' | `script:${string}`;
  ```

### 2. `src/pages/research/ResearchInsights.tsx`
- Fetch active scripts from `research_scripts` (id, name) to populate the campaign type dropdown dynamically
- Add each script as a `<SelectItem value="script:{id}">` in the dropdown
- When a `script:*` campaign type is selected, render a new `<ScriptInsightsPanel scriptId={id} />` component inline (same position where Audience Survey and Move-Out render)
- The existing Move-Out and Audience Survey flows remain completely untouched

### 3. Create `src/components/research-insights/ScriptInsightsPanel.tsx`
- Extract the core logic from `src/pages/ScriptResults.tsx` into a reusable panel component (no layout wrapper, no back button)
- Receives `scriptId` as a prop
- Fetches script questions from `research_scripts.questions` JSONB
- Fetches responses from `script_responses` table with pagination
- Renders Overview tab (KPIs, trend, section completion) and Script Responses tab (dynamic charts per question)
- Includes Word export button in header area

### 4. `src/pages/research/ScriptBuilder.tsx`
- Remove the "Results" button from script cards (lines 290-298)
- Remove the `BarChart3` import if no longer used

### 5. `src/App.tsx`
- Remove the `/research/scripts/:scriptId/results` route
- Remove the `ScriptResults` import

### 6. `src/pages/ScriptResults.tsx`
- Delete this file (its logic moves to `ScriptInsightsPanel`)

## How It Works
1. User navigates to Research Insights
2. Dropdown shows: Move-Out Research, Audience Survey, + any active scripts by name
3. Selecting a script renders its results inline with the same KPI cards, charts, and Word export
4. Adding new scripts in Script Builder automatically makes them appear in the dropdown
5. Existing Move-Out and Audience Survey insights are completely unaffected

## Technical Notes
- Scripts query uses `react-query` with key `["research-scripts-for-insights"]`
- Only scripts with `is_active = true` appear in dropdown
- The `ScriptInsightsPanel` reuses `DynamicQuestionCard`, `ScriptResultsOverview`, and `generateDynamicReport` — all already created
- No database changes needed

