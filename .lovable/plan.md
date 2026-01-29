
# Historical Call Recordings Import Implementation Plan

## Overview
Create a dedicated import page for processing HubSpot-exported call recording data. **All records** will be stored in the `bookings` table (central repository), with a new "Non Booking" status to distinguish call records that didn't result in a booking. The Non Booking Insights page will filter this data.

---

## Phase 1: Add "Non Booking" Status to System

### 1.1 Update Status Filter in Reports Page
**File: `src/pages/Reports.tsx`**

Add "Non Booking" to the `statusOptions` array:
```
{ label: 'Non Booking', value: 'Non Booking' }
```

Add styling for the new status in `statusColors`:
```
'Non Booking': 'bg-slate-500/20 text-slate-500'
```

Update summary statistics to include Non Booking count.

### 1.2 Update Types Definition
**File: `src/types/index.ts`**

Add "Non Booking" to the Booking status type:
```
status: 'Pending Move-In' | 'Moved In' | 'Member Rejected' | 'No Show' | 'Cancelled' | 'Postponed' | 'Non Booking';
```

---

## Phase 2: Create HubSpot CSV Parser

### 2.1 New Parser File
**File: `src/utils/hubspotCallParser.ts`**

Key functionality:
- **Fix malformed CSV**: Detect and fix the single-line format by identifying record boundaries
- **Parse HubSpot-specific columns**:
  | CSV Column | Maps To |
  |------------|---------|
  | `Activity Date` | `booking_date`, `move_in_date` |
  | `Activity assigned to` | Agent lookup |
  | `Recording URL` | `kixie_link` |
  | `Associated Contact` | Parse to `member_name` (extract name from "Name (email)" format) |
  | `Call outcome` | Determines status classification |
  | `Call duration (HH:mm:ss)` | `call_duration_seconds` |
  | `Record ID` | Construct HubSpot link |
  | `Call direction` | `booking_type` (Inbound/Outbound) |
  | `Call summary` | Strip HTML, store in `notes` |

- **Classification logic**:
  - `Call outcome` = "Booking Call" or "24-hour Booking" → `status = "Pending Move-In"`
  - All other outcomes (e.g., "Left VM") → `status = "Non Booking"`

- **Date parsing**: Handle M/D/YY format
- **Duration conversion**: Parse HH:mm:ss to total seconds
- **Contact name extraction**: Parse "Name (email)" format to get member name

---

## Phase 3: Agent Mapping Component

### 3.1 New Component
**File: `src/components/import/AgentMappingDialog.tsx`**

Features:
- Display list of agent names found in CSV vs. existing agents
- Show match status for each (found/missing)
- Options for missing agents:
  - **Auto-create**: Create new agents under selected site (default: Vixicom)
  - **Skip**: Exclude records from unknown agents
  - **Manual map**: Map CSV names to existing agents (for variations like "Win ." vs "Win")
- Fuzzy matching suggestions for similar names

---

## Phase 4: Historical Import Page

### 4.1 New Page
**File: `src/pages/HistoricalImport.tsx`**

#### Workflow Steps:

**Step 1: File Upload**
- Drag & drop zone for CSV files (extends current Excel support)
- Accept `.csv` and `.xlsx` files
- Show file size and parsing progress

**Step 2: Parsing**
- Call HubSpot parser
- Display progress bar during parsing
- Handle the malformed single-line CSV format

**Step 3: Agent Pre-Scan**
- Extract unique agent names from parsed data
- Match against existing agents in database
- Show summary: "Found X unique agents, Y missing from system"
- Open Agent Mapping Dialog if missing agents detected

**Step 4: Classification Summary**
- Show record breakdown:
  - "X records classified as Bookings (status: Pending Move-In)"
  - "Y records classified as Non-Bookings (status: Non Booking)"
- Preview table with sample records

**Step 5: Duplicate Detection**
- Check each record against existing bookings
- Criteria: `member_name` + `agent_id` + `booking_date` (case-insensitive)
- Also check by `kixie_link` for exact recording URL match
- Show: "Found Z potential duplicates (will be skipped)"

**Step 6: Import Execution**
- Batch insert in chunks of 50 records
- Add 100ms delay between batches
- Real-time progress bar
- Estimated time based on record count

**Step 7: Results Summary**
- Show: "Imported A bookings, B non-bookings, C skipped (duplicates), D failed"
- Navigation buttons:
  - "View in Reports" → `/reports`
  - "View Non-Bookings" → `/call-insights`

---

## Phase 5: Update Non Booking Insights Page

### 5.1 Modify Data Source
**File: `src/pages/CallInsights.tsx`**

Current behavior: Queries `calls` table
New behavior: Query `bookings` table with filter `status = 'Non Booking'`

Changes:
- Update query to use `bookings` table instead of `calls`
- Filter by `status = 'Non Booking'`
- Map bookings fields to existing Call interface:
  | Bookings Field | Call Field |
  |----------------|------------|
  | `id` | `id` |
  | `kixie_link` | `recording_url` |
  | `booking_date` | `call_date` |
  | `call_duration_seconds` | `duration_seconds` |
  | `agent_id` | `agent_id` |
  | `member_name` | `contact_name` |
  | `booking_type` | `call_type` (Inbound/Outbound) |
  | `transcription_status` | `transcription_status` |
  | `notes` | For call summary display |

- Maintain existing coaching/transcription features
- Update filters to work with bookings table fields

---

## Phase 6: Navigation & Routing

### 6.1 Add Sidebar Link
**File: `src/components/layout/AppSidebar.tsx`**

Add new menu item in admin group:
```
{
  icon: Upload,
  label: 'Historical Import',
  path: '/historical-import',
  roles: ['super_admin', 'admin'],
  group: 'admin'
}
```

### 6.2 Add Route
**File: `src/App.tsx`**

Add protected route for `/historical-import` with admin roles.

---

## Technical Details

### CSV Parsing Strategy (Malformed File Fix)

The uploaded file has all data on a single line. The parser will:
1. Read entire file as string
2. Identify record boundaries by detecting Record ID patterns (e.g., `1.02E+11`)
3. Split into individual records
4. Parse each record using comma-separated logic
5. Handle quoted fields with embedded commas (especially in Call summary)

### Data Mapping Summary

| HubSpot CSV | Bookings Table | Notes |
|-------------|----------------|-------|
| Record ID | `hubspot_link` | Construct URL |
| Activity Date | `booking_date`, `move_in_date` | Same value for both |
| Activity assigned to | `agent_id` | Lookup by name |
| Call direction | `booking_type` | Map to Inbound/Outbound |
| Recording URL | `kixie_link` | Direct mapping |
| Associated Contact | `member_name` | Parse name from "Name (email)" |
| Call outcome | `status` | Classification logic |
| Call duration (HH:mm:ss) | `call_duration_seconds` | Convert to seconds |
| Call summary | `notes` | Strip HTML tags |

### Batch Processing

- Parse: Client-side using FileReader API
- Insert: 50 records per batch
- Delay: 100ms between batches
- Progress: Real-time percentage display
- Error handling: Log failures, continue with remaining records

### Duplicate Prevention

```text
For each parsed record:
  1. Check by kixie_link (recording URL) - if exists, skip
  2. Check by member_name + agent_id + booking_date - if exists, skip
  3. Otherwise, insert
```

---

## Files Summary

### New Files (4)
| File | Purpose |
|------|---------|
| `src/utils/hubspotCallParser.ts` | Parse HubSpot CSV format with malformed line fix |
| `src/pages/HistoricalImport.tsx` | Import page with full workflow |
| `src/components/import/AgentMappingDialog.tsx` | Handle missing agents |
| `src/components/import/ImportClassificationSummary.tsx` | Show booking vs non-booking breakdown |

### Modified Files (5)
| File | Changes |
|------|---------|
| `src/pages/Reports.tsx` | Add "Non Booking" status filter and styling |
| `src/pages/CallInsights.tsx` | Change data source to bookings table with status filter |
| `src/types/index.ts` | Add "Non Booking" to Booking status type |
| `src/components/layout/AppSidebar.tsx` | Add Historical Import link |
| `src/App.tsx` | Add route for `/historical-import` |

---

## Data Access After Import

| Record Type | Where to View | How to Filter |
|-------------|---------------|---------------|
| All Records | Reports (`/reports`) | Default view shows all |
| Booking Records | Reports (`/reports`) | Status ≠ "Non Booking" |
| Non-Booking Records | Reports (`/reports`) | Status = "Non Booking" |
| Non-Booking Records | Non Booking Insights (`/call-insights`) | Automatic filter |

---

## Transcription Icon Logic (Preserved)

The existing transcription status icons in Reports will work automatically for imported records:
- Records with `kixie_link` + no transcription → Show headphones icon (click to transcribe)
- Records with `transcription_status = 'completed'` → Show purple FileText icon
- Records with `transcription_status = 'processing'` → Show spinning amber loader
- Records with `transcription_status = 'pending'` → Show spinning muted loader
- Records with `transcription_status = 'failed'` → Show red warning icon

All imported records will have `kixie_link` (Recording URL) and `transcription_status = null`, making them ready for the transcription pipeline.
