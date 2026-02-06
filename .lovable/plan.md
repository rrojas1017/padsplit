

# Clean Up Old Pre-Fix Non-Booking Insights

## Current State
The database shows stale analysis records with the old format (40 objections at 1% each) still being displayed for certain periods:

| Period | Created | Objection Count | Status |
|--------|---------|-----------------|--------|
| thisMonth | Feb 6, 17:34 | **11** ✅ New format |
| last3months | Feb 6, 17:24 | 40 ❌ Old format |
| last30days | Feb 6, 17:07 | 40 ❌ Old format |
| last30days | Feb 6, 17:03 | 0 ❌ Empty |
| last30days | Feb 6, 16:40 | 40 ❌ Old format |
| last30days | Feb 6, 16:30 | **8** ✅ New format |
| allTime | Feb 6, 16:23 | **10** ✅ New format |

## Action Required
Delete 4 stale records with old/broken format so only properly grouped analyses remain:

### Records to Delete
1. `186704c9-63b3-4105-a43a-ba3667b4e617` - last3months (40 objections)
2. `52c1d5e7-1b37-477d-853a-eae400e84cd9` - last30days (40 objections)
3. `411e5412-4250-40c3-944d-658f80bb2ad3` - last30days (0 objections)
4. `3f861538-8788-4a4f-96e4-9d293ed434ba` - last30days (40 objections)

## Implementation

### Step 1: Delete Stale Records
Execute this SQL to remove old pre-fix analysis records:

```sql
DELETE FROM non_booking_insights
WHERE id IN (
  '186704c9-63b3-4105-a43a-ba3667b4e617',
  '52c1d5e7-1b37-477d-853a-eae400e84cd9',
  '411e5412-4250-40c3-944d-658f80bb2ad3',
  '3f861538-8788-4a4f-96e4-9d293ed434ba'
);
```

### Step 2: Result After Cleanup
Remaining valid analyses:
- **thisMonth**: 11 grouped patterns ✅
- **last30days**: 8 grouped patterns ✅  
- **allTime**: 10 grouped patterns ✅
- **last3months**: None (will show "Run Analysis" prompt)
- **last7days**: None (will show "Run Analysis" prompt)

### Step 3: Re-run Analysis for Missing Periods
After cleanup, you can click "Run Analysis" on the `last3months` and `last7days` periods to generate fresh insights with properly grouped objections.

## Expected Outcome
- All periods will show meaningful 6-12 category groupings with accurate percentages
- No more 40+ items at 1% frequency
- Clean slate for any period without a valid post-fix analysis

