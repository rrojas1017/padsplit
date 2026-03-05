

# Fix Research Insights Pipeline — 3 Root Causes Found

## Problems Identified

### 1. Wrong AI Gateway URL (causes 404 errors)
Both `process-research-record` and `generate-research-insights` call `https://api.lovable.dev/v1/chat/completions` — this returns **404**. Every other working edge function in the project uses `https://ai.gateway.lovable.dev/v1/chat/completions`. This is why no records have been successfully processed.

### 2. Frontend Stats Query Checks Wrong Table
`useResearchInsightsData.ts` line 39-44 counts records using `bookings.call_transcription` — but for research records, the transcript is stored in `booking_transcriptions.call_transcription`, not on the `bookings` table. Result: stats show "0 research records found" when there are actually 96 valid records with transcripts.

### 3. Stale `processing` Records Block Backfill
3 records are stuck in `research_processing_status = 'processing'` from failed attempts. The batch processor and per-record function reject these with 409 Conflict. Need to auto-reset records stuck in `processing` for >15 minutes.

## Fixes

### Fix 1: Correct AI Gateway URL
**Files**: `supabase/functions/process-research-record/index.ts` (line 52), `supabase/functions/generate-research-insights/index.ts` (line 332)

Change `https://api.lovable.dev/v1/chat/completions` → `https://ai.gateway.lovable.dev/v1/chat/completions` in the `callLovableAI` function of both files.

### Fix 2: Fix Stats Query to Join booking_transcriptions
**File**: `src/hooks/useResearchInsightsData.ts` (lines 39-44)

Replace the `bookings.call_transcription` check with a proper join:
```typescript
const { count: totalCount } = await supabase
  .from('booking_transcriptions')
  .select('id, bookings!inner(record_type, has_valid_conversation)', { count: 'exact', head: true })
  .not('call_transcription', 'is', null);
```
With filters on the referenced `bookings` table for `record_type = 'research'` and `has_valid_conversation = true`.

### Fix 3: Auto-Reset Stale Processing Records
**File**: `supabase/functions/batch-process-research-records/index.ts`

Before fetching unprocessed records, reset any records stuck in `processing` for >15 minutes back to `null` status so they re-enter the queue.

**File**: `supabase/functions/process-research-record/index.ts`

Change the `processing` status check (line 297-302) to allow re-processing if the record has been stuck for >15 minutes.

### Fix 4: Reset Currently Stuck Records
Use the insert tool to reset the 3 currently stuck records:
```sql
UPDATE booking_transcriptions SET research_processing_status = NULL WHERE research_processing_status = 'processing' AND updated_at < NOW() - INTERVAL '15 minutes';
```

