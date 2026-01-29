
# Historical Import: Safe Import with Tracking & PadSplit Agent Support

## Overview
Add safeguards to the historical import process so you can:
1. **Track all imported records** with a unique batch ID for easy identification and deletion
2. **Default unmatched agents to PadSplit Internal** site instead of Vixicom
3. **View and manage import batches** after completion

---

## What This Adds

### 1. Import Batch Tracking
- Each import creates a unique **batch ID** (e.g., `IMPORT-20260129-143022`)
- All records from that import are tagged with this ID
- Easy to identify: "These 500 records came from Tuesday's import"

### 2. Safe Rollback Capability  
- One-click delete option for any import batch
- Only deletes records from that specific import
- Your existing 644 records remain untouched

### 3. PadSplit Agent Default
- Unmatched agents will default to **PadSplit Internal** site instead of Vixicom
- Makes sense since most unmatched agents are PadSplit's internal team

---

## How It Will Work

```text
+----------------+     +------------------+     +------------------+
| Upload CSV     | --> | Agent Mapping    | --> | Review & Import  |
| (Your file)    |     | (Default:        |     | (Batch ID shown) |
|                |     |  PadSplit site)  |     |                  |
+----------------+     +------------------+     +------------------+
                                                         |
                                                         v
                                          +-----------------------------+
                                          | Import Complete             |
                                          | Batch: IMPORT-20260129-...  |
                                          | [View in Reports]           |
                                          | [Delete This Batch]         |
                                          +-----------------------------+
```

---

## Technical Changes

| Area | Change |
|------|--------|
| **Database** | Add `import_batch_id` column to `bookings` table (nullable, for backwards compatibility) |
| **Agent Mapping Dialog** | Change default site from Vixicom to PadSplit Internal |
| **Import Page** | Generate batch ID at start, include in all inserts |
| **Completion Screen** | Show batch ID, add "Delete Batch" button |
| **Parser Utility** | Update `toBookingInsert` to accept batch ID parameter |

### Database Migration
```sql
ALTER TABLE bookings 
ADD COLUMN import_batch_id TEXT DEFAULT NULL;

CREATE INDEX idx_bookings_import_batch ON bookings(import_batch_id) 
WHERE import_batch_id IS NOT NULL;
```

### Batch ID Format
`IMPORT-{YYYYMMDD}-{HHMMSS}` (e.g., `IMPORT-20260129-143022`)

---

## After Implementation

**To delete a historical import:**
1. Go to Historical Import page
2. Click "Delete This Batch" after import completes
3. Or query: `DELETE FROM bookings WHERE import_batch_id = 'IMPORT-...'`

**Your existing data is safe:**
- All 644 current records have `import_batch_id = NULL`
- Only new imports will have batch IDs
- Delete operations only target specific batch IDs
