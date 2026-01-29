
# Reports Page Enhancement: Server-Side Pagination with All Records Access

## Overview

This plan implements **Option B: Server-Side Pagination** to allow viewing all 5,807+ records (including the 5,018 imported records) with proper terminology updates to reflect that this page shows both bookings and non-bookings.

---

## Problem Summary

| Issue | Current State | Impact |
|-------|--------------|--------|
| 90-day date filter | Hardcoded in `BookingsContext.tsx` | 3,436 of 5,018 imported records (68%) hidden |
| 500 record limit | Hardcoded in query | Even recent records capped |
| "Booking Date" terminology | Used throughout | Inaccurate for non-booking calls |

---

## Solution Architecture

The Reports page will get its own dedicated data fetching hook that queries the database directly with server-side pagination, bypassing the global `BookingsContext` restrictions when "All Time" is selected.

```text
Current Flow:
BookingsContext (90-day limit, 500 cap) --> Reports Page --> Client-side pagination

New Flow:
Reports Page --> useReportsData hook --> Direct DB query with:
                                          - Server-side pagination (50/page)
                                          - Optional date filtering
                                          - Import batch filter
                                          - Total count for UI
```

---

## Implementation Steps

### Step 1: Create Server-Side Pagination Hook

**New File: `src/hooks/useReportsData.ts`**

This hook will:
- Query bookings directly from the database with server-side pagination
- Support "All Time" mode (no date restriction) or specific date ranges
- Include optional import batch filtering
- Return total count for pagination UI
- Handle sorting server-side for efficiency

Key parameters:
- `page`: Current page number (1-indexed)
- `pageSize`: Records per page (default 50)
- `dateRange`: Optional date filter (null = all time)
- `importBatchId`: Optional filter for specific import batches
- `sortColumn` and `sortDirection`: For server-side sorting
- All existing filters (status, site, agent, type, method, search)

---

### Step 2: Add Import Batch Filter Component

**New filter option in Reports page:**

- Dropdown to filter by import source:
  - "All Records" (default)
  - "Manual Entries" (where import_batch_id IS NULL)
  - Import batches with timestamps and record counts:
    - "IMPORT-20260129-002412 (5,018 records)"
    - "IMPORT-20260129-235838 (145 records)"

---

### Step 3: Update Terminology Throughout Reports Page

| Current | New |
|---------|-----|
| "Booking Date" column header | "Record Date" |
| "Booking Date" filter label | "Record Date" |
| DateRangePicker label="Booking Date" | label="Record Date" |
| "No bookings found matching your filters" | "No records found matching your filters" |
| "Detailed booking data and exports" | "Detailed call records and exports" |
| Pagination: "of X bookings" | "of X records" |
| "Add Booking" button | Keep as is (action still adds bookings) |

---

### Step 4: Update Reports Page to Use New Hook

**Modifications to `src/pages/Reports.tsx`:**

1. Replace `useBookings()` with new `useReportsData()` hook
2. Add import batch filter state and UI
3. Update terminology in labels and messages
4. Implement server-side pagination controls
5. Show total record count from server (not client-filtered count)
6. Add loading skeleton for page transitions

---

### Step 5: Add Database Index for Performance

**Database Migration:**

```sql
CREATE INDEX IF NOT EXISTS idx_bookings_record_date_batch 
ON bookings(booking_date DESC, import_batch_id);

CREATE INDEX IF NOT EXISTS idx_bookings_import_batch 
ON bookings(import_batch_id) WHERE import_batch_id IS NOT NULL;
```

This ensures fast queries when filtering by date or import batch with 5,000+ records.

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/useReportsData.ts` | CREATE | Server-side pagination hook with direct DB queries |
| `src/pages/Reports.tsx` | MODIFY | Use new hook, add import batch filter, update terminology |
| Database migration | CREATE | Add performance indexes |

---

## Technical Details

### useReportsData Hook Structure

```text
Parameters:
- filters: {
    dateRange: { from?: Date, to?: Date } | null  // null = all time
    importBatchId: string | 'manual' | 'all'
    siteId: string | 'all'
    status: string | 'all'
    bookingType: string | 'all'
    communicationMethod: string | 'all'
    agentId: string | 'all'
    rebookingFilter: 'all' | 'new' | 'rebooking'
    searchQuery: string
  }
- pagination: {
    page: number
    pageSize: number
  }
- sorting: {
    column: SortColumn
    direction: 'asc' | 'desc'
  }

Returns:
- records: Booking[]           // Current page of records
- totalCount: number           // Total matching records (for pagination)
- isLoading: boolean
- error: Error | null
- importBatches: { id: string, count: number, date: string }[]  // For filter dropdown
- refetch: () => void
```

### Query Strategy

When "All Time" is selected:
- Remove the `.gte('booking_date', dateLimit)` filter
- Use `.range(offset, offset + pageSize - 1)` for pagination
- Get total count with separate `.count()` query

Performance is maintained by:
- Server-side pagination (max 100 records per query)
- Database indexes on booking_date and import_batch_id
- Only fetching columns needed for the table view

---

## UI Changes Preview

### New Import Batch Filter
```text
[Package Icon] All Records ▼
  ├── All Records
  ├── Manual Entries (789 records)
  ├── ─────────────────────────
  ├── IMPORT-20260129-002412 (5,018 records)
  └── IMPORT-20260129-235838 (145 records)
```

### Updated Pagination Footer
```text
Current:  "Showing 1-20 of 500 bookings"
New:      "Showing 1-50 of 5,807 records"
```

---

## Expected Outcome

After implementation:
- "All Time" filter shows all 5,807 records
- Import batch filter quickly isolates imported vs manual records
- Fast page loads with 50 records at a time
- Consistent "Record Date" terminology throughout
- No changes needed to other pages that use BookingsContext

---

## Dependencies

- No new npm packages required
- Uses existing Supabase client and types
- Pagination UI already exists, just needs different data source
