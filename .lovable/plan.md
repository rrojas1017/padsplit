
Goal: make “Process All” run to completion automatically (no manual restarts), and remove the current stall condition.

What I found (root cause)
1) The batch function stops chaining when `hasMore` is false, and `hasMore` is currently computed as:
- `hasMore = toProcess.length === BATCH_SIZE`
2) `toProcess` is reduced after an in-memory filter. In production data, some “eligible” rows have `call_transcription = ''` (empty string), so a fetched batch of 5 often becomes 4 processable rows.
3) That makes `hasMore` false even when many records remain queueable (confirmed in DB + logs), so self-retrigger does not fire.
4) The current retrigger call is also not checking non-OK HTTP responses, so failures can be silent.
5) Current processing call is synchronous/long-running; we should use the project’s existing background pattern (`EdgeRuntime.waitUntil`) to avoid request-timeout coupling.

Implementation plan

1) Refactor `batch-process-research-records` to background-run a single chunk per invocation
- File: `supabase/functions/batch-process-research-records/index.ts`
- Add `EdgeRuntime.waitUntil(...)` pattern (already used in other project functions).
- Request handler returns quickly for both:
  - initial start (`action: "start"` default)
  - internal continuation (`action: "continue"`)

2) Fix candidate selection so empty transcripts don’t poison batch size
- In queue query, exclude empty strings at DB level (`neq('', ...)`) in addition to `not null`.
- Keep a defensive `trim().length > 0` check before dispatching each booking.
- Optionally fetch a small candidate buffer (`BATCH_SIZE * 2 or *3`) then slice to first 5 valid records so one bad row cannot shrink effective throughput.

3) Replace brittle continuation condition
- Remove `hasMore = toProcess.length === BATCH_SIZE`.
- After processing chunk, run a dedicated remaining-count query with the same queue criteria.
- Continue if `remainingCount > 0`.
- Return payload including `processed`, `failed`, `remainingCount`, `retriggered`.

4) Make self-retrigger resilient and observable
- Trigger next run via internal call with `action: "continue"`.
- Check `response.ok`; if not ok, log status + response text.
- Add one retry with short backoff for transient network failures.
- Log structured markers:
  - `Found X candidates / Y processable`
  - `Processed A, failed B, remaining R`
  - `Self-retrigger success/failure`

5) Align UI progress to processable records
- File: `src/hooks/useResearchInsightsData.ts`
- Update processing stats queries to use the same “processable transcript” criteria (exclude empty transcript strings), so pending count can truly reach zero.
- Keep current poll behavior, but pending should now converge naturally and stop banner state correctly.

Technical details (proposed flow)

```text
User clicks Process All
  -> batch-process-research-records (start)
      returns immediately
      EdgeRuntime.waitUntil(runOneBatch)

runOneBatch:
  1) reset stale "processing" > 15m
  2) fetch queue candidates (null/failed + non-empty transcript)
  3) process up to 5 in 3-way parallel chunks
  4) count remaining queueable
  5) if remaining > 0:
       call same function with { action: "continue" } (check response + retry)
```

Why this fixes the stall
- Empty transcript rows no longer reduce effective batch size from 5 to 4 in a way that kills chaining.
- Continuation is based on actual remaining queue, not current processed count equality.
- Each invocation is backgrounded and fast to return, preventing long request chains from blocking progression.

Validation plan after implementation
1) Run dry-run: confirm `totalUnprocessed` reflects real queue.
2) Click Process All once.
3) Confirm logs show repeated `continue` invocations without manual clicks.
4) Confirm processed count steadily increases past current stall points.
5) Confirm pending reaches zero (for processable records) and UI exits “Processing...” automatically.
