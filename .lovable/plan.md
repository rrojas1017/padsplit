

# Centralize Research Records into the Reports Page

## Overview

Make the `bookings` table the single source of truth for ALL records -- bookings and research calls alike. When a researcher logs a survey call, the system will also insert a corresponding row into the `bookings` table flagged as a "Research" record. This means the Reports page automatically becomes the centralized hub, and all downstream processing (transcription, AI analysis, coaching, insights) can operate on research records too.

## How It Will Work

When a researcher submits a call via the Log Survey Call form, the system will:
1. Insert into `research_calls` as it does today (preserving campaign/script/responses data)
2. Also insert a row into `bookings` with:
   - `record_type` = `'research'` (new column, default `'booking'`)
   - `status` = `'Research'` (new status value)
   - `booking_type` = `'Research'`
   - `member_name` = caller name
   - `booking_date` = call date
   - `contact_phone` = caller phone
   - `research_call_id` = FK back to `research_calls` for drill-down
   - `created_by` = researcher's user ID
   - `move_in_date` = same as call date (required column, displayed as "--" for research)
   - `agent_id` = a designated placeholder or the researcher's linked agent record

In the Reports page, research records will be visually flagged with a purple "Research" badge (similar to how "Non Booking" and "Rebooking" are flagged today), and a new "Record Type" filter will let admins toggle between All, Bookings Only, and Research Only.

## Database Changes

### New columns on `bookings` table

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `record_type` | text | `'booking'` | Distinguishes `'booking'` vs `'research'` records |
| `research_call_id` | uuid (nullable, FK to research_calls.id) | null | Links back to the detailed research call data |

### Validation trigger update
The existing `validate_manual_booking_contacts` trigger requires email + phone for manual bookings. It needs to skip validation for research records (which may not have an email).

## Changes Required

### 1. Database Migration
- Add `record_type` text column with default `'booking'`
- Add `research_call_id` uuid column (nullable, FK to `research_calls`)
- Update `validate_manual_booking_contacts` trigger to skip research records
- Add index on `record_type` for efficient filtering

### 2. Research Call Submission (`useResearchCalls.ts`)
- After inserting into `research_calls`, also insert a corresponding row into `bookings` with `record_type = 'research'`
- Use the returned `research_calls.id` as the `research_call_id` FK value
- Set `agent_id` to the first available agent or handle via a "Research" pseudo-agent approach -- since `agent_id` is required, we'll create a system-level "Research Team" agent record, or use the researcher's own profile. The simplest approach: use a `created_by` field and set `agent_id` to any valid agent (the Reports page already shows "Agent" column, but for research records we'll display "Researcher: Name" instead)

### 3. Types Update (`src/types/index.ts`)
- Add `'Research'` to the Booking `status` union type
- Add `'Research'` to the `bookingType` union type
- Add `recordType?: 'booking' | 'research'` field
- Add `researchCallId?: string` field

### 4. Reports Data Hook (`useReportsData.ts`)
- Add `record_type` and `research_call_id` to the select query
- Add `recordTypeFilter` to `ReportsFilters` interface (values: `'all'`, `'booking'`, `'research'`)
- Apply filter: when `'booking'` selected, filter `record_type = 'booking'`; when `'research'`, filter `record_type = 'research'`
- Map `record_type` and `research_call_id` in the transform

### 5. Reports Page UI (`Reports.tsx`)
- Add a "Record Type" filter dropdown with options: All Records, Bookings Only, Research Only
- Add `'Research'` to status options and status colors (purple theme: `bg-purple-500/20 text-purple-500`)
- In the table rows, show a purple "Research" badge next to the contact name for research records
- For research records: Move-In Date shows "--", Agent column shows researcher name, Type shows "Research"
- Add a "Research" summary card in the stats row
- Update CSV export to include a "Record Type" column

### 6. Booking Type/Status References
- Add `'Research'` to `bookingTypeOptions` in Reports
- Add `'Research'` status to `statusOptions` in Reports
- Ensure other pages (Dashboard, Leaderboard, etc.) that count bookings filter by `record_type = 'booking'` OR ignore research status gracefully (since they already filter by specific statuses like "Moved In", "Pending Move-In", they won't accidentally count research records)

## Visual Flagging in Reports

Research records will stand out through:
- A purple "Research" status badge (consistent with researcher role color)
- A small "Research" tag next to the contact name (similar to the "Rebooking" tag)
- Campaign name shown in the Notes/Market column area when available
- Move-In Date column shows "--" (like Non Booking)
- Agent column shows "Researcher: [Name]" instead of agent name

## What This Enables

With research records in the bookings table:
- Centralized search across ALL call records
- CSV export includes everything
- Future: transcription pipeline can process research calls the same way
- Future: AI insights can analyze research calls alongside booking calls
- Date filtering, pagination, and sorting work automatically
- Import batch tracking naturally excludes research (they have no batch ID)

## Files to Edit
- `src/hooks/useResearchCalls.ts` -- dual-insert into bookings on submit
- `src/hooks/useReportsData.ts` -- add record_type filter + field mapping
- `src/pages/Reports.tsx` -- add Record Type filter, Research status/badges, summary card
- `src/types/index.ts` -- add Research to type unions, add new fields

## Implementation Order
1. Database migration (add columns + update trigger)
2. Update TypeScript types
3. Update `useResearchCalls.ts` to dual-insert
4. Update `useReportsData.ts` with new filter + field
5. Update `Reports.tsx` UI with filter, badges, and summary card
