

## Add Stall Detection & Heartbeat Tracking

### Problem
The UI shows "Running" status but cannot detect when the background loop has crashed or timed out. Users have no way to know if processing has stalled.

### Solution: Add Last Activity Timestamp + Stall Indicator

#### 1. Database Change
Add a `last_activity_at` column to track when the job last processed a record:

```sql
ALTER TABLE bulk_processing_jobs 
ADD COLUMN last_activity_at TIMESTAMPTZ;
```

#### 2. Edge Function Update (`bulk-transcription-processor/index.ts`)

Update `updateJobProgress` calls to include timestamp:

```typescript
// After each record is processed
await updateJobProgress(supabase, jobId, {
  processed_count: (progressJob?.processed_count || 0) + 1,
  last_activity_at: new Date().toISOString()  // Add this
});
```

#### 3. UI Update (`BulkProcessingTab.tsx`)

Add stall detection logic:

```typescript
// Check if job appears stalled (no activity for 2+ minutes when running)
const isStalled = activeJob?.status === 'running' && 
  activeJob?.last_activity_at && 
  (Date.now() - new Date(activeJob.last_activity_at).getTime()) > 120000;
```

Display stall warning:

```tsx
{isStalled && (
  <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
    <AlertTriangle className="w-4 h-4 text-yellow-500" />
    <span className="text-sm text-yellow-500">
      No activity for {Math.round((Date.now() - new Date(activeJob.last_activity_at).getTime()) / 60000)} minutes
    </span>
    <Button size="sm" variant="outline" onClick={() => startJob(activeJob.id, 'resume')}>
      Resume
    </Button>
  </div>
)}
```

#### 4. Hook Update (`useBulkProcessingJobs.ts`)

Add `last_activity_at` to the interface and type.

### What This Provides
- **Real-time heartbeat:** Each processed record updates the timestamp
- **Visual stall warning:** Yellow banner appears if no activity for 2+ minutes
- **One-click recovery:** Resume button directly in the warning banner
- **Accurate monitoring:** Know exactly when the last record was processed

### Files to Modify
1. Database migration (new column)
2. `supabase/functions/bulk-transcription-processor/index.ts`
3. `src/components/import/BulkProcessingTab.tsx`
4. `src/hooks/useBulkProcessingJobs.ts`

