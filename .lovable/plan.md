
# Fix: Budget Data Not Showing in Market Intelligence

## Root Cause
The edge function `aggregate-market-data` code in the repository correctly extracts `weeklyBudget` from `call_key_points -> memberDetails -> weeklyBudget` (line 160-164). However, the **currently deployed** version of this function appears to be stale -- the fresh cache generated at 04:19:33 has null budgets for ALL 28 states, even though 2,328 out of 5,914 transcription records contain valid numeric budget data.

## Fix
1. **Redeploy the `aggregate-market-data` edge function** -- no code changes needed, just a redeployment to pick up the current version.
2. **Clear the stale cache** so the next request generates fresh data with budgets included:
   - Run: `DELETE FROM market_intelligence_cache` (or at least delete the `all_all_3` entry).
3. **Refresh the page** to trigger a new aggregation with the redeployed function.

## Verification
After redeployment and cache clear, the dashboard should show:
- "Avg Weekly Budget" card with a dollar amount (likely around $200-300 based on the data)
- Budget values on each Top 10 market card with green/red color coding
- Budget column populated in the state heat table
