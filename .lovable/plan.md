
## Prevent Bulk Processing Stalls with Auto-Resume Architecture

### Problem Analysis
The current bulk processor uses `EdgeRuntime.waitUntil()` which has a maximum wall-clock time limit (~150 seconds). When processing 4,600+ records at 10-second pacing, the background loop inevitably times out after processing only 10-15 records per invocation.

### Solution: Self-Retriggering Chunked Processing

Instead of running one long loop that times out, we implement a **chunk-and-retrigger** pattern where:
1. The function processes a small batch (e.g., 10 records)
2. At the end, it calls itself to continue processing
3. This creates a chain of short-lived function calls that can run indefinitely

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Current Architecture                          │
│  ┌──────────┐                                                    │
│  │  Start   │──▶ Process 1 ──▶ Process 2 ──▶ ... ──▶ TIMEOUT!  │
│  └──────────┘     (10s wait)    (10s wait)      (after ~90s)    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    New Architecture                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ Chunk 1  │──▶ │ Chunk 2  │──▶ │ Chunk 3  │──▶ │ Chunk N  │  │
│  │ (10 recs)│    │ (10 recs)│    │ (10 recs)│    │ Complete │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │               │               │               │         │
│       └── self-call ──┘── self-call ──┘── self-call ──┘        │
└─────────────────────────────────────────────────────────────────┘
```

### Technical Changes

#### 1. Modify Edge Function (`bulk-transcription-processor/index.ts`)

**New processing strategy:**

```typescript
// Configuration
const RECORDS_PER_CHUNK = 10;  // Process 10 records per function invocation
const MAX_CHUNK_DURATION_MS = 100000;  // Safety: max 100s per chunk

async function runProcessingLoop(
  supabase: any,
  jobId: string,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<void> {
  const startTime = Date.now();
  let recordsProcessedThisChunk = 0;
  
  while (true) {
    // Safety checks: stop if we've processed enough or running too long
    if (recordsProcessedThisChunk >= RECORDS_PER_CHUNK) {
      console.log(`[BulkProcessor] Chunk complete (${recordsProcessedThisChunk} records)`);
      break;
    }
    
    if (Date.now() - startTime > MAX_CHUNK_DURATION_MS) {
      console.log(`[BulkProcessor] Chunk time limit reached`);
      break;
    }
    
    // ... existing status check and record processing ...
    
    recordsProcessedThisChunk++;
  }
  
  // Check if job should continue
  const { data: currentJob } = await supabase
    .from('bulk_processing_jobs')
    .select('status')
    .eq('id', jobId)
    .single();
  
  if (currentJob?.status === 'running') {
    // Check if more records remain
    const pendingCount = await getPendingCount(supabase, job.site_filter);
    
    if (pendingCount > 0) {
      // Self-retrigger: call the function again to continue
      console.log(`[BulkProcessor] Retriggering for ${pendingCount} remaining records`);
      
      await fetch(`${supabaseUrl}/functions/v1/bulk-transcription-processor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ 
          jobId, 
          action: 'continue'  // New action for internal retrigger
        }),
      });
    } else {
      // Mark job as completed
      await updateJobProgress(supabase, jobId, {
        status: 'completed',
        completed_at: new Date().toISOString()
      });
    }
  }
}
```

**New 'continue' action handler:**

```typescript
case 'continue': {
  // Internal action - just start the next chunk
  EdgeRuntime.waitUntil(
    runProcessingLoop(supabase, jobId, supabaseUrl, supabaseServiceKey)
  );
  
  return new Response(
    JSON.stringify({ success: true, message: 'Continuing processing' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

#### 2. Add Chunk Tracking to Database

Add a column to track chunk progress for monitoring:

```sql
ALTER TABLE bulk_processing_jobs 
ADD COLUMN chunk_count INTEGER DEFAULT 0;
```

Update the function to increment this counter each chunk, providing visibility into how many "restarts" have occurred.

#### 3. UI Enhancement (Optional)

Show chunk count in the job details for transparency:

```typescript
// In BulkProcessingTab.tsx
{activeJob.chunk_count > 0 && (
  <span className="text-xs text-muted-foreground">
    Chunk #{activeJob.chunk_count}
  </span>
)}
```

### Why This Works

1. **No timeouts**: Each chunk runs for ~100 seconds max (well under limits)
2. **Automatic recovery**: If a chunk fails, the stall detection triggers a resume which starts a new chunk
3. **Efficient**: Minimal overhead from the self-call (~50ms)
4. **Reliable**: Uses database state as the source of truth; any chunk can pick up where the last left off
5. **Observable**: Heartbeat updates every record, chunk count shows progress

### Processing Math for 4,600 Records

| Metric | Value |
|--------|-------|
| Records per chunk | 10 |
| Pacing between records | 10 seconds |
| Chunk duration | ~100 seconds |
| Total chunks needed | 460 |
| Total processing time | ~12.8 hours |
| Function invocations | ~460 |

### Files to Modify

1. **Database migration**: Add `chunk_count` column
2. **`supabase/functions/bulk-transcription-processor/index.ts`**: Implement chunked processing with self-retrigger
3. **`src/hooks/useBulkProcessingJobs.ts`**: Add `chunk_count` to interface
4. **`src/components/import/BulkProcessingTab.tsx`**: Display chunk count (optional)
