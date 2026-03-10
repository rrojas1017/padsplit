

## Fix: Research Insights stuck showing failed report + synthesis timeout

### Two problems

1. **UI shows failed report instead of last good one**: `fetchReports` always selects the most recent report. When that's `failed`, users see the error screen with no way to access previous completed reports.

2. **Synthesis step times out**: With 157 records split into 4 chunks, all 4 chunk analyses complete successfully (~6 min), but the final synthesis call (combining 4 large JSON results) gets killed by edge runtime shutdown at ~7 min wall clock.

### Fix 1: UI fallback to last completed report

**File: `src/hooks/useResearchInsightsData.ts`** — lines 81-87

Change `fetchReports` to find the first **completed** report and select it. Only show a failed/processing report if there are no completed reports at all.

```typescript
// After setting reports:
const firstCompleted = (data || []).find(r => r.status === 'completed');
if (firstCompleted) {
  await fetchReportDetail(firstCompleted.id);
} else if (data && data.length > 0) {
  setSelectedReport(data[0] as ResearchInsightReport);
} else {
  setSelectedReport(null);
}
```

### Fix 2: Make synthesis resilient to wall-clock limits

**File: `supabase/functions/generate-research-insights/index.ts`** — synthesis section (~lines 285-311)

The synthesis call sends all 4 full chunk JSON results (~massive payload) to the AI. This takes too long before the runtime kills the function.

Two changes:
- **Use Gemini Flash** for the synthesis call (faster, cheaper) instead of Pro
- **Add a programmatic merge fallback**: wrap the synthesis AI call in a `Promise.race` with a 90-second timeout. If it times out, merge chunk results programmatically (concatenate arrays, average numbers) — this gives a "good enough" report rather than failing entirely.

```typescript
// Synthesis with timeout fallback
const synthesisPromise = callLovableAI(lovableApiKey, 'google/gemini-2.5-flash', temperature, ...);
const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('synthesis_timeout')), 90000));

try {
  const synthesisResult = await Promise.race([synthesisPromise, timeoutPromise]);
  // parse as before
} catch (e) {
  if (e.message === 'synthesis_timeout') {
    console.log('[Insights] Synthesis timed out, using programmatic merge');
    finalResult = programmaticMerge(chunkResults);
  } else throw e;
}
```

Add a `programmaticMerge` helper that combines chunk results by concatenating arrays and taking the first chunk's scalar fields.

### Summary of changes
- **`src/hooks/useResearchInsightsData.ts`**: Auto-select latest completed report
- **`supabase/functions/generate-research-insights/index.ts`**: Use Flash for synthesis + timeout fallback with programmatic merge

