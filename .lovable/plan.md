
## Fix Stale Callback After Analysis Completion

### Problem
When an analysis completes, the polling hook calls `onComplete()` which triggers `fetchInsightsCallback`. However, this callback is memoized with an empty dependency array, potentially causing it to use a stale `fetchInsights` function that doesn't properly refresh the UI.

### Solution

**File: `src/components/call-insights/BookingInsightsTab.tsx`**

Update the callback to ensure fresh data is fetched:

```typescript
// Before (line 88-91):
const fetchInsightsCallback = useCallback(() => {
  fetchInsights();
  setIsAnalyzing(false);
}, []); // Empty deps = stale closure

// After:
const fetchInsightsCallback = useCallback(() => {
  // Force fresh fetch by clearing any cached state
  setIsLoading(true);
  fetchInsights();
  setIsAnalyzing(false);
}, [dateRange]); // Include dateRange dependency
```

Additionally, since `fetchInsights` is defined inside the component but not memoized, we should either:
1. Move `fetchInsights` inside the useCallback, or
2. Wrap `fetchInsights` in its own `useCallback` with proper dependencies

**Recommended approach** - wrap the fetch in useCallback:

```typescript
const fetchInsights = useCallback(async () => {
  try {
    const periodFilters = getPeriodFilters(dateRange);
    // ... rest of the function
  } catch (error) {
    // ... error handling
  } finally {
    setIsLoading(false);
  }
}, [dateRange]);

const fetchInsightsCallback = useCallback(() => {
  fetchInsights();
  setIsAnalyzing(false);
}, [fetchInsights]);
```

**File: `src/pages/MemberInsights.tsx`**

Apply the same fix to the standalone Member Insights page if it has the same pattern.

### Verification
After this fix:
1. Run an analysis for any date range
2. Wait for polling to detect completion
3. UI should automatically refresh and display the new analysis without needing a manual page refresh
