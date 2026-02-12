

## Fix: Stale Cache Serving Null Budgets

### Root Cause
The cache entry `all_all_3` was generated at 03:29 (before the transcription fix was deployed) and stored null budget values. Since the cache is valid for 30 minutes, every request returns this stale data instead of running the fixed aggregation logic.

Proof the fix works: cache entry `all_all_2` was freshly computed after the fix and correctly shows `avgWeeklyBudget: 257`.

### Solution (Two Parts)

**1. Clear stale cache entries (immediate fix)**
Delete all `market_intelligence_cache` rows where `all` is in the cache key and budgets are null. This forces fresh computation on the next request.

**2. Prevent future stale cache issues**
- Change `.single()` to `.maybeSingle()` on the cache lookup (line 41) to prevent errors when no cache entry exists
- Reduce cache TTL from 30 minutes to 15 minutes to match the original design intent (the comment on line 36 says "15 minutes" but the code checks for 30 minutes)

### Technical Changes

**Database**: Run SQL to delete stale cache entries:
```sql
DELETE FROM market_intelligence_cache 
WHERE cache_key LIKE 'all_all_%';
```

**File: `supabase/functions/aggregate-market-data/index.ts`**
- Line 41: Change `.single()` to `.maybeSingle()`
- Line 45: Change `30 * 60 * 1000` to `15 * 60 * 1000` (align with the comment)

### Expected Result
After clearing the cache and redeploying, selecting "All Time" will trigger a fresh computation that correctly includes budget data with green/red color coding for all markets.
