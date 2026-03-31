

## Create "PadSplit Audience Survey - Market Launch 2025" Research Script

### What we're building
A new research script pre-loaded with all 12 questions from the pasted survey, using the existing script infrastructure. The script will be distinguishable from the existing move-out script by its campaign type and name.

### Approach: Insert via edge function or direct DB call
Since the `createScript` hook already handles insertion, the cleanest approach is to add the new campaign type + target audience options to the UI dropdowns, then create the script programmatically via a one-time database insert (migration).

### Changes

**1. Add new campaign type and target audience options**

In `src/components/research/ResearchScriptDialog.tsx` and `src/pages/research/ScriptBuilder.tsx`:
- Add `{ value: 'audience_survey', label: 'Audience Survey' }` to `CAMPAIGN_TYPES`
- Add new target audiences: `{ value: 'account_created', label: 'Account Created' }`, `{ value: 'application_started', label: 'Application Started' }`, `{ value: 'approved_not_booked', label: 'Approved (Not Booked)' }`, `{ value: 'active_member', label: 'Active Members' }`
- Add filter option for `audience_survey` in ScriptBuilder's filter dropdown

**2. Insert the script via database migration**

A SQL migration that inserts a row into `research_scripts` with:
- **name**: "PadSplit Audience Survey - Market Launch 2025"
- **campaign_type**: "audience_survey"
- **target_audience**: "active_member"
- **is_active**: true
- **intro_script**: Professional greeting introducing the survey purpose
- **rebuttal_script**: Polite decline handling
- **closing_script**: Thank-you with mention of the $100 video opportunity
- **questions**: JSONB array with all 12 questions, each containing:
  - `order`, `question`, `type` (multiple_choice or yes_no), `required`, `options` array, `ai_extraction_hint`, `section` grouping
  - Sections: "Social Media & Content", "Ad Awareness", "Ad Engagement", "First Impressions", "Ad Preferences", "Video Opportunity"
  - Branching on Q2 (yes → show text field), Q3 (yes → show text field), Q5 (conditional on Q4 answer)
  - Q12 (video interest) as yes_no with the $100 incentive note

### How agents distinguish scripts
- Each campaign is linked to exactly one script via `script_id`
- The script name "PadSplit Audience Survey - Market Launch 2025" appears on the campaign card and in the call logging UI
- The `campaign_type` badge ("Audience Survey") visually differentiates it from "Satisfaction" scripts in the Script Builder list
- When logging calls, agents select the campaign (which auto-loads the correct script)

### Files changed (2) + 1 migration

| File | Change |
|---|---|
| `src/components/research/ResearchScriptDialog.tsx` | Add `audience_survey` campaign type + 4 new target audiences |
| `src/pages/research/ScriptBuilder.tsx` | Add `audience_survey` label + filter option |
| Migration SQL | Insert the full script with 12 questions |

No backend function changes. No new components.

