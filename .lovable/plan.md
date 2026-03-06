

## Fix: Two research insight reports stuck in "processing"

**Root cause**: The report was triggered twice after the migration fix, creating two concurrent insight records. The edge function's `EdgeRuntime.waitUntil()` background processing was interrupted when a new invocation caused a shutdown/reboot cycle. Both records are now permanently stuck in `processing`.

### Steps

1. **Database cleanup** — Mark the two stuck records as failed so they don't block the UI:
   ```sql
   UPDATE research_insights 
   SET status = 'failed', error_message = 'Interrupted by concurrent invocation'
   WHERE id IN ('4643c1b8-5019-43a9-8830-87801859c2a4', '4cff2d10-da6b-4685-b9b6-71bb4c7e8450')
   AND status = 'processing';
   ```

2. **Re-trigger the report** — After cleanup, generate a fresh report from the Research Insights page (single click). The constraint fix is now in place, so it should work end-to-end.

No code changes needed — this is a data cleanup issue from the double-trigger.

