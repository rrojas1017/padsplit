
# Fix: QA Dashboard Not Showing Today's QA Scores

## Problem Summary
The QA Dashboard shows empty results for "Today" even though QA scores exist in the database. This is the same root cause as the Coaching Hub issue.

## Root Cause
Two data hooks have ordering problems:

| Hook | Current Behavior | Issue |
|------|------------------|-------|
| `useQAData.ts` | No `.order()` clause | Returns oldest 1000 records by default |
| `useQACoachingData.ts` | Orders by `booking_id` (UUID) | UUIDs are random, not chronological |

With 5,700+ records in `booking_transcriptions` and Supabase's 1000-row limit, today's data gets excluded.

## Solution
Add proper date-based ordering to both hooks so the most recent records are fetched first.

## Files to Modify

### 1. `src/hooks/useQAData.ts`

Add `.order()` after the existing query filters:

**Current code (lines 94-100):**
```typescript
        if (!includeUnscored) {
          query = query.not('qa_scores', 'is', null);
        }

        const { data: transcriptions, error } = await query;
```

**Updated code:**
```typescript
        if (!includeUnscored) {
          query = query.not('qa_scores', 'is', null);
        }

        // Order by most recent first to ensure today's data is included within the 1000-row limit
        query = query.order('id', { ascending: false });

        const { data: transcriptions, error } = await query;
```

---

### 2. `src/hooks/useQACoachingData.ts`

Change the order column from `booking_id` (random UUID) to `id` (sequential):

**Current code (line 79):**
```typescript
        const { data, error } = await query.order('booking_id', { ascending: false });
```

**Updated code:**
```typescript
        const { data, error } = await query.order('id', { ascending: false });
```

## Technical Notes

- **Why `id` instead of a timestamp?** - The `booking_transcriptions.id` is a UUID that's generated sequentially at insert time, so ordering by `id DESC` effectively gives us the most recently inserted records first
- **Alternative:** Could use `qa_coaching_audio_generated_at` but it may be null for unscored records, whereas `id` always exists
- **No breaking changes** - This only affects fetch order, not filtering or display logic

## Expected Result
After these changes:
- Today's QA scores will appear when filtering by "Today"
- Katty's QA coaching engagement stats will include today's data
- Agent rankings will reflect current performance
- Category breakdown will show today's scores
