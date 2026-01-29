

# Fix 1,000 Row Query Limit

## Problem

Supabase has a **default limit of 1,000 rows** per query. The code fetching bookings for matching doesn't override this limit, so only ~1,000 records are checked for matches instead of all 4,791.

## Current Code (Line 88-92)

```typescript
const { data: bookingsWithEmail } = await supabase
  .from('bookings')
  .select('contact_email')
  .is('contact_phone', null)
  .not('contact_email', 'is', null);
// ⚠️ Missing pagination - only gets first 1,000 rows
```

## Solution

Fetch all records using pagination (in batches of 1,000):

```typescript
// Fetch ALL bookings needing phone enrichment using pagination
let allBookings: { contact_email: string }[] = [];
let page = 0;
const pageSize = 1000;

while (true) {
  const { data: batch } = await supabase
    .from('bookings')
    .select('contact_email')
    .is('contact_phone', null)
    .not('contact_email', 'is', null)
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (!batch || batch.length === 0) break;
  
  allBookings = [...allBookings, ...batch];
  page++;
  
  // If we got less than pageSize, we've reached the end
  if (batch.length < pageSize) break;
}
```

## Files to Modify

| File | Change |
|------|--------|
| `src/components/import/PhoneEnrichmentTab.tsx` | Add pagination to preview query (lines 88-92) |
| `src/components/import/PhoneEnrichmentTab.tsx` | Add pagination to enrichment query (in `executeEnrichment`) |

## Expected Result

| Metric | Before | After |
|--------|--------|-------|
| Potential Matches | 990 | ~4,700+ |
| Records Processed | 1,000 | All 4,791 |

