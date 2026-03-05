

# Add Survey Progress Column to Research Reports

## What
Add a "Progress" column to the Research view in Reports showing how many survey questions were answered per call (e.g., "5/12 questions"), with a small progress bar for visual indication.

## Data Flow
- `bookings.research_call_id` → `research_calls.responses` (JSONB with question IDs as keys) + `research_calls.campaign_id`
- `research_campaigns.script_id` → `research_scripts.questions` (JSON array of all questions)
- Answered count = `Object.keys(responses).length`
- Total count = `questions.length` from the script

## Changes

### 1. `src/hooks/useReportsData.ts`
- Add a nested join in the select query for research_calls data:
  ```
  research_calls!bookings_research_call_id_fkey (
    responses,
    research_campaigns!research_calls_campaign_id_fkey (
      research_scripts!research_campaigns_script_id_fkey (
        questions
      )
    )
  )
  ```
- Add two new fields to the transformed Booking type: `questionsAnswered` (number) and `questionsTotal` (number), computed from the joined data

### 2. `src/types/index.ts`
- Add `questionsAnswered?: number` and `questionsTotal?: number` to the `Booking` interface

### 3. `src/pages/Reports.tsx`
- Add a "Progress" column header between "Duration" and "Agent" in the research table headers
- Add a table cell showing:
  - Text: "5/12" format
  - A small `<Progress>` bar underneath showing percentage completion
  - Color coding: green (100%), amber (50-99%), red (<50%)
- Update skeleton column count from 9 to 10
- Update empty-state colSpan from 10 to 11

## No backend changes needed
All data already exists in the database; we just need to join across the existing foreign keys.

