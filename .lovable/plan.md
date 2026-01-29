

# Fix Batch Record Count Limit

## Problem

The "Existing Import Batches" section shows only **1,000 records** instead of the actual **5,018 records** because:

1. The current code fetches individual rows: `supabase.from('bookings').select('import_batch_id, created_at')`
2. Supabase has a **default limit of 1,000 rows** per query
3. The code then counts rows in JavaScript, giving an inaccurate total

**Verified from database**: The actual counts are:
- `IMPORT-20260129-002412`: **5,018 records**
- `IMPORT-20260129-235838`: **145 records**

---

## Solution

Create a database function (RPC) that uses `GROUP BY` and `COUNT(*)` directly in SQL, bypassing the row limit issue.

---

## Implementation

### Step 1: Database Migration

Create an RPC function that returns accurate batch counts:

```sql
CREATE OR REPLACE FUNCTION get_import_batch_counts()
RETURNS TABLE (
  import_batch_id text,
  record_count bigint,
  imported_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.import_batch_id,
    COUNT(*)::bigint as record_count,
    MIN(b.created_at) as imported_at
  FROM bookings b
  WHERE b.import_batch_id IS NOT NULL
  GROUP BY b.import_batch_id
  ORDER BY MIN(b.created_at) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Step 2: Update Historical Import Page

**File: `src/pages/HistoricalImport.tsx`**

Replace the current `fetchExistingBatches` function:

**Before** (hitting 1,000 row limit):
```typescript
const { data, error } = await supabase
  .from('bookings')
  .select('import_batch_id, created_at')
  .not('import_batch_id', 'is', null);
// Then count in JavaScript...
```

**After** (accurate count via RPC):
```typescript
const { data, error } = await supabase.rpc('get_import_batch_counts');

if (error) throw error;

const batches: ExistingBatch[] = (data || []).map((row: any) => ({
  import_batch_id: row.import_batch_id,
  record_count: Number(row.record_count),
  imported_at: row.imported_at,
}));

setExistingBatches(batches);
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| Database migration (RPC function) | CREATE |
| `src/pages/HistoricalImport.tsx` | MODIFY (lines 80-119) |

---

## Expected Result

After the fix, the batch display will show:
- `IMPORT-20260129-002412`: **5,018 records** (not 1,000)
- `IMPORT-20260129-235838`: **145 records**

