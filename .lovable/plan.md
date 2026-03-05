

# Redesign Reports Page with View-Driven UI (Bookings vs Research)

## Summary
Replace the record type dropdown filter with a prominent Tabs toggle (Bookings / Research) at the top. The entire page — summary cards, filters, table columns, and row actions — adapts based on which view is selected.

## Changes (all in `src/pages/Reports.tsx`)

### 1. View Toggle
Replace the `recordTypeFilterOptions` array and the FlaskConical dropdown (lines 76-80, 518-538) with a `Tabs` component rendered above the summary cards. Two tabs: **Bookings** (default) and **Research**. The tab value drives `recordTypeFilter` state (values: `'booking'` | `'research'`).

### 2. Summary Cards — Conditional by View

**Bookings view** (lines 429-499 — keep current cards minus the Research card):
Total Records, Pending Move-In, Postponed, Moved In, Member Rejected, No Show/Cancelled, Non Booking, Issues Detected

**Research view** (replace entire cards section):
- Total Calls (total count)
- Successful Calls (valid conversation + >=2min)
- Avg Duration (formatted as Xm Ys)
- Issues Detected
- Campaigns (count of distinct campaigns if available, otherwise omit)

### 3. Filters — Conditional by View

**Hide from Research view** (wrapped in `{!isResearch && ...}`):
- Move-In Date range picker
- Status filter
- Booking Type filter
- Communication Method filter
- Rebooking filter
- Conversation Validity filter
- Import Batch filter

**Hide from Research view in Row 2**:
- "Add Booking" button

**Keep for both views**: Record Date, Site, Agent, Search, Pain Point Issues, Items per page, Export CSV, Clear Filters

### 4. Table Columns — Conditional by View

**Bookings view** (current columns, no change):
Record Date, Move-In Date, Contact, Email, Phone, Agent, Market, Type, Status, Priority, Churn Risk, Method, Issues, Links, Actions

**Research view** (new column set):
| Column | Source |
|--------|--------|
| Call Date | `bookingDate` |
| Contact (phone-first) | `contactPhone` or cleaned `memberName` |
| Name | `memberName` (if enriched, not "API Submission") |
| Email | `contactEmail` |
| Duration | `callDurationSeconds` formatted as `Xm Ys` |
| Agent | agent name |
| Market | `marketCity, marketState` |
| Transcription | status icon |
| Issues | detected issues badges |
| Actions | View Transcript only |

Hidden for research: Move-In Date, Type, Status, Priority, Churn Risk, Method, Links (HubSpot/Kixie/Admin), full status-change actions menu

### 5. Actions Menu — Research View
Replace the full status-change dropdown with just:
- View Transcript (if kixie link exists)
- No status change options, no "Edit Full Details"

### 6. CSV Export — View-Aware
Adjust CSV headers/columns based on `isResearch` to match the visible columns.

### 7. Duration Formatter Helper
Add a small helper function:
```typescript
const formatDuration = (seconds: number | null | undefined): string => {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
};
```

## Implementation Approach
- Use a single `const isResearch = recordTypeFilter === 'research'` boolean throughout
- Wrap booking-specific sections in `{!isResearch && ...}`
- Wrap research-specific sections in `{isResearch && ...}`
- The data hook (`useReportsData`) already handles `recordTypeFilter` — no backend changes needed
- Reset filters to defaults when switching views (clear booking-only filters when switching to research)

## Files Changed
- `src/pages/Reports.tsx` — major conditional rendering refactor

