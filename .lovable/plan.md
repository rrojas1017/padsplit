

## Fix: Total Records Count Should Respect Site Filter

### Current Behavior
- The UI shows "37 / 5,013" because the count query ignores the `site_filter` setting
- The actual processing IS correct - only Vixicom records are being processed
- But the total count shows ALL pending records instead of just Vixicom records

### Root Cause
In `supabase/functions/bulk-transcription-processor/index.ts`, lines 364-372:

```typescript
// Count total pending records - IGNORES SITE FILTER!
let countQuery = supabase
  .from('bookings')
  .select('id', { count: 'exact', head: true })
  .is('transcription_status', null)
  .not('kixie_link', 'is', null)
  .not('kixie_link', 'eq', '');

// Note says: "Supabase count doesn't support joins well"
const { count } = await countQuery;
```

The comment admits the limitation, but we need to fix this for accurate progress tracking.

### Solution

Apply the same site filter logic to the count query. Since Supabase count with joins is tricky, we'll use a different approach - count the actual filtered records.

**File to modify:** `supabase/functions/bulk-transcription-processor/index.ts`

**Changes at lines 361-380:**

```typescript
case 'start':
case 'resume': {
  // Get filtered count based on site_filter
  let totalCount = 0;
  
  if (job.site_filter === 'vixicom_only') {
    // Count Vixicom records using the same join logic
    const { data: vixicomAgents } = await supabase
      .from('agents')
      .select('id, sites!inner(name)')
      .ilike('sites.name', '%vixicom%');
    
    const agentIds = (vixicomAgents || []).map((a: any) => a.id);
    
    if (agentIds.length > 0) {
      const { count } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .is('transcription_status', null)
        .not('kixie_link', 'is', null)
        .not('kixie_link', 'eq', '')
        .in('agent_id', agentIds);
      totalCount = count || 0;
    }
  } else if (job.site_filter === 'non_vixicom') {
    // Count non-Vixicom records
    const { data: vixicomAgents } = await supabase
      .from('agents')
      .select('id, sites!inner(name)')
      .ilike('sites.name', '%vixicom%');
    
    const vixicomAgentIds = (vixicomAgents || []).map((a: any) => a.id);
    
    // Get total pending, then subtract Vixicom count
    const { count: totalPending } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .is('transcription_status', null)
      .not('kixie_link', 'is', null)
      .not('kixie_link', 'eq', '');
    
    let vixicomCount = 0;
    if (vixicomAgentIds.length > 0) {
      const { count } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .is('transcription_status', null)
        .not('kixie_link', 'is', null)
        .not('kixie_link', 'eq', '')
        .in('agent_id', vixicomAgentIds);
      vixicomCount = count || 0;
    }
    totalCount = (totalPending || 0) - vixicomCount;
  } else {
    // All records
    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .is('transcription_status', null)
      .not('kixie_link', 'is', null)
      .not('kixie_link', 'eq', '');
    totalCount = count || 0;
  }
  
  // Update job to running with CORRECT count
  await updateJobProgress(supabase, jobId, {
    status: 'running',
    started_at: job.started_at || new Date().toISOString(),
    total_records: totalCount,
    paused_at: null
  });
  
  // ... rest stays the same
}
```

### What This Fixes
- Vixicom-only jobs will show "37 / 394" instead of "37 / 5,013"
- Non-Vixicom jobs will show correct "X / 4,619"
- All jobs will show "X / 5,013"
- ETA will be accurate (currently showing 13.8 hours when it should be ~1 hour for 394 records)

### Current Job Status
Your "Vix wave 3" job IS processing correctly - it's only touching Vixicom records. The display is just wrong. After this fix, new jobs will show accurate totals.

