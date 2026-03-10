

## Fix: Polling never fires after clicking Generate Report

### Root Cause

The `useResearchInsightsPolling` hook has a React lifecycle race condition:

1. User clicks "Generate Report" → `setPhase('analyzing')` triggers a re-render
2. `handleGenerate` calls `startPolling(insightId)` which sets up a `setInterval`
3. The re-render causes `refreshCallback` → `onComplete` → `startPolling` / `stopPolling` to get new identities
4. The cleanup effect on line 156 (`useEffect(() => () => stopPolling(), [stopPolling])`) fires because `stopPolling` changed identity, **clearing the interval immediately**
5. Result: polling never actually runs, UI shows no progress

The report IS running in the backend (chunk 1/6, 175 records) but the UI has no way to know.

### Fix

**File: `src/hooks/useResearchInsightsPolling.ts`**

1. **Remove the dependency array from the cleanup effect** — change `[stopPolling]` to `[]` so the cleanup only runs on unmount, not on every re-render:
   ```ts
   useEffect(() => {
     return () => { stopPolling(); };
   }, []); // Only cleanup on unmount
   ```

2. **Stabilize `stopPolling`** — it's already wrapped in `useCallback` with `[]` deps, so it should be stable. But to be safe, also stabilize `startPolling` by removing `onComplete` from its dependency array and using a ref for `onComplete` instead:
   ```ts
   const onCompleteRef = useRef(onComplete);
   useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
   ```
   Then reference `onCompleteRef.current()` inside the polling interval instead of `onComplete()`.

3. **Fix `NodeJS.Timeout` type error** — change `useRef<NodeJS.Timeout | null>` to `useRef<ReturnType<typeof setInterval> | null>` (4 files affected, but only the polling hook is critical).

### Files to Edit
- `src/hooks/useResearchInsightsPolling.ts` — stabilize polling lifecycle with refs, fix cleanup effect

### Impact
- The progress banner and progress bar will appear immediately after clicking Generate
- Polling will correctly track chunk completion (1/6 → 6/6 → synthesizing → done)
- The elapsed time counter will work properly

