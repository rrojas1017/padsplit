
# Add Batch Deletion Before Re-Import

## Problem
You need to delete the existing ~5,163 imported records before re-importing the CSV to capture email and phone data. Currently, the delete button only appears after completing a new import.

## Solution
Add a "Manage Existing Batches" section to the Historical Import upload step that shows existing import batches and allows deletion before starting a new import.

---

## Implementation

### Update Historical Import Page

**File: `src/pages/HistoricalImport.tsx`**

Add a new section on the upload step that:

1. **Fetches existing import batches** on page load:
```typescript
// Query distinct import_batch_ids with record counts
SELECT import_batch_id, COUNT(*) as record_count, MIN(created_at) as imported_at
FROM bookings
WHERE import_batch_id IS NOT NULL
GROUP BY import_batch_id
ORDER BY imported_at DESC
```

2. **Displays batch list** with:
   - Batch ID (e.g., `IMPORT-20260129-002412`)
   - Record count (e.g., "5,163 records")
   - Import date
   - Delete button

3. **Delete batch function**:
   - Confirm dialog: "Delete 5,163 records from batch IMPORT-20260129-002412?"
   - Delete all records with that batch ID
   - Refresh the batch list

### UI Layout

On the upload step, above the file drop zone:

```text
┌─────────────────────────────────────────────────────┐
│  📦 Existing Import Batches                         │
├─────────────────────────────────────────────────────┤
│  IMPORT-20260129-002412                             │
│  5,163 records • Imported Jan 29, 2026              │
│                                        [🗑️ Delete]  │
├─────────────────────────────────────────────────────┤
│  (No other batches)                                 │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  📤 Upload HubSpot Export                           │
│  [Drop zone as before]                              │
└─────────────────────────────────────────────────────┘
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/HistoricalImport.tsx` | Add batch list state, fetch on mount, render batch cards, delete function |

---

## Workflow After Implementation

1. Open **Historical Import** page
2. See existing batch: `IMPORT-20260129-002412` (5,163 records)
3. Click **Delete** → Confirm → Records removed
4. Upload the same HubSpot CSV file
5. Complete import → All records now have email and phone populated
6. View in **Reports** page with new Email/Phone columns
