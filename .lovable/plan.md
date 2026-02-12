

# Survey Call Form and Researcher Pages - End-to-End Flow

## Overview

The Campaign Manager (admin side) is already built. This plan completes the researcher-facing side of the flow so the full pipeline works:

**Admin creates script -> Admin creates campaign -> Researcher sees campaign -> Researcher logs calls using script**

Three stub pages need to be replaced with functional implementations, plus a new data hook for managing research calls.

---

## What Gets Built

### 1. New Hook: `useResearchCalls.ts`

Manages CRUD operations for the `research_calls` table.

- **fetchMyCalls()**: Get all calls logged by the current researcher, with campaign name joined
- **fetchCampaignsForResearcher()**: Get active campaigns assigned to the current user (filters `research_campaigns` where `assigned_researchers` array contains the user's ID)
- **submitCall()**: Insert a new research call record with responses stored as JSONB
- Uses the existing `research_calls` table schema (campaign_id, researcher_id, caller_name, caller_phone, caller_type, caller_status, call_outcome, responses, researcher_notes, etc.)

### 2. My Campaigns Page (`MyCampaigns.tsx`)

Replace the stub with a functional page showing campaigns assigned to the logged-in researcher.

- Fetches campaigns where `assigned_researchers` contains the current user ID
- Filters to only show `active` campaigns (with option to see all)
- Each campaign card shows: name, script name, progress (completed/target), date range, status badge
- "Start Calling" button navigates to `/research/log-call?campaign=<id>`
- Empty state when no campaigns are assigned

### 3. Log Survey Call Form (`LogSurveyCall.tsx`) - The Core Feature

Replace the stub with a dynamic, guided call-logging form.

**Step 1 - Campaign Selection**:
- Dropdown of active campaigns assigned to the researcher
- Auto-selects if navigated from "My Campaigns" with query param
- Once selected, fetches the linked script and its questions

**Step 2 - Caller Information**:
- Caller name (required)
- Caller phone (optional)
- Caller type dropdown: existing_member, former_booking, rejected_lead
- Caller status: active, churned, prospect

**Step 3 - Dynamic Script Questions**:
- Renders each question from the script's JSONB `questions` array based on its type:
  - **Scale (1-10)**: Slider or numbered button group
  - **Open Ended**: Textarea input
  - **Multiple Choice**: Radio button group with the defined options
  - **Yes/No**: Two-button toggle (Yes / No)
- Required questions are marked and validated before submission
- Responses stored as JSONB: `{ "q1": 8, "q2": "Great experience", "q3": "Option B", ... }`

**Step 4 - Call Outcome**:
- Outcome selector: completed, no_answer, refused, callback_requested, transferred
- If "transferred": show transfer fields (agent selector, transfer notes)
- Researcher notes textarea
- Call duration (optional, manual entry in minutes)

**Step 5 - Submit**:
- Validates required fields and required script questions
- Inserts into `research_calls` with the researcher's user ID
- Success toast and option to "Log Another Call" or "View History"
- Resets form for next call

### 4. My Call History Page (`MyCallHistory.tsx`)

Replace the stub with a table/list of the researcher's past calls.

- Table columns: Date, Campaign, Caller Name, Caller Type, Outcome, Duration
- Filter by campaign and outcome
- Click a row to expand and see responses + notes
- Sort by date (newest first by default)
- Shows total call count and today's count as summary cards

---

## Technical Details

### Data Flow for Call Submission
```
Researcher selects campaign
       |
       v
Hook fetches campaign.script_id
       |
       v
Hook fetches research_scripts record
       |
       v
Form renders questions[] dynamically
       |
       v
Researcher fills responses + metadata
       |
       v
INSERT into research_calls {
  campaign_id, researcher_id,
  caller_name, caller_type, call_outcome,
  responses: { q1: value, q2: value, ... },
  researcher_notes, call_duration_seconds
}
```

### Response Storage Format
Script questions are keyed by their order number in the JSONB `responses` column:
```json
{
  "1": 8,
  "2": "They loved the pricing",
  "3": "Option A",
  "4": true
}
```

### Files to Create
- `src/hooks/useResearchCalls.ts` - Call CRUD + campaign fetching for researchers

### Files to Edit
- `src/pages/research/MyCampaigns.tsx` - Replace stub with functional campaign list
- `src/pages/research/LogSurveyCall.tsx` - Replace stub with dynamic survey form
- `src/pages/research/MyCallHistory.tsx` - Replace stub with call history table

### No Database Changes Needed
All tables (`research_campaigns`, `research_scripts`, `research_calls`) already exist with the correct schema and RLS policies.

---

## Implementation Order

1. Create `useResearchCalls.ts` hook (data layer first)
2. Build `MyCampaigns.tsx` (simplest page, validates campaign fetching works)
3. Build `LogSurveyCall.tsx` (core feature, depends on hook)
4. Build `MyCallHistory.tsx` (reads submitted calls)
