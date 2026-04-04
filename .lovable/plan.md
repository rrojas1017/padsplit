

# Fix: Duplicate Scripts in Research Insights Dropdown

## Problem
The dropdown has 2 hardcoded items (Move-Out Research, Audience Survey) plus ALL active scripts from the database. But the Move-Out and Audience Survey scripts also exist as rows in `research_scripts`, so they show up twice — once hardcoded and once dynamically.

## Solution
Filter out scripts whose `campaign_type` matches `move_out_survey` or `audience_survey` from the dynamic query, since those two already have dedicated hardcoded entries and their own specialized dashboards.

## Change

| File | Change |
|------|--------|
| `src/pages/research/ResearchInsights.tsx` | Add `.not('campaign_type', 'in', '("move_out_survey","audience_survey")')` to the `activeScripts` query (line ~111), so only custom scripts appear in the dynamic portion of the dropdown |

This way:
- Move-Out Research and Audience Survey keep their hardcoded entries and specialized dashboards
- Only truly new/custom scripts (like the Post Move-In Satisfaction survey) appear dynamically
- Adding more scripts in the future works automatically without duplication

