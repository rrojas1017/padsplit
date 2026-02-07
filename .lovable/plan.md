
# Fix: QA Dashboard Not Showing Today's Data - Corrected Order Column

## Problem Summary
The QA Dashboard shows only 1 record for "today" instead of 21, even after the previous fix was applied.

## Root Cause (Updated)
The previous fix ordered by `id` (UUID), but **Supabase UUIDs are random, not sequential**. Ordering by UUID gives unpredictable results - the records with IDs starting with `ff` happen to be from older booking dates.

**Evidence:**
| ID (sorted DESC) | created_at | booking_date |
|------------------|------------|--------------|
| `ffe79c83...` | 2026-02-05 | 2025-09-02 |
| `ffe2df2c...` | 2026-02-05 | 2025-03-04 |
| `ffcd194f...` | 2026-02-06 | 2025-03-21 |

When ordering by `created_at DESC` instead:
| ID | created_at | booking_date |
|----|------------|--------------|
| `6443a806...` | 2026-02-06 23:48 | **2026-02-06** |
| `9d7329d1...` | 2026-02-06 23:22 | **2026-02-06** |
| `02822f81...` | 2026-02-06 22:37 | **2026-02-06** |

## Solution
Change from ordering by `id` to ordering by `created_at` in both hooks.

## Files to Modify

### 1. `src/hooks/useQAData.ts`

**Line 101 - Change order column:**

```typescript
// Current (incorrect):
query = query.order('id', { ascending: false });

// Fixed:
query = query.order('created_at', { ascending: false });
```

---

### 2. `src/hooks/useQACoachingData.ts`

**Line 79 - Change order column:**

```typescript
// Current (incorrect):
const { data, error } = await query.order('id', { ascending: false });

// Fixed:
const { data, error } = await query.order('created_at', { ascending: false });
```

## Why This Works

| Column | Type | Chronological? |
|--------|------|----------------|
| `id` | UUID | ❌ Random |
| `booking_id` | UUID | ❌ Random |
| `created_at` | timestamp | ✅ Sequential |

The `created_at` timestamp is set when the transcription record is inserted, making it the reliable chronological marker.

## Expected Result
After this fix:
- Today's 21 QA records (booking_date = 2026-02-06) will appear first in the fetched data
- The "Today" filter will show all 21 records
- Agent rankings and category breakdown will reflect today's data
