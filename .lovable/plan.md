
# Fix: Member Insights Analysis Stopping When Changing Views

## Problem Identified

The `analyze-member-insights` edge function is being terminated when you navigate away from the page. The logs show:
- 03:33:06 - "Sending data to AI for analysis..."
- 03:33:33 - "shutdown" (27 seconds later, before AI could respond)

The analysis for 600+ calls requires 1-3 minutes, but the function is killed mid-execution.

## Root Cause

1. **Frontend awaits the response synchronously** - the `runAnalysis` function waits for the edge function to complete
2. **Component unmounts on navigation** - when you change views, the React component unmounts and the fetch request is aborted
3. **Edge function terminates** - without a client connection, the function shuts down

## Solution: Background Task Pattern

Convert the analysis to run as a true background task that continues even if the user navigates away.

### Changes Required

**1. Update Edge Function to Use Background Tasks**

Modify `analyze-member-insights` to:
- Immediately return a response with a "processing" status
- Use `EdgeRuntime.waitUntil()` to continue processing in the background
- Create a status record the frontend can poll

**2. Add Analysis Status Tracking**

Create a simple status tracking mechanism in the `member_insights` table or a new table to track:
- Analysis ID
- Status: `processing` | `completed` | `failed`
- Progress info (optional)

**3. Update Frontend to Poll for Completion**

Modify `MemberInsights.tsx` to:
- Trigger analysis and receive an immediate response
- Show a persistent status indicator (even if navigating away and back)
- Poll for completion or use a toast notification

---

## Technical Implementation

### Edge Function Changes

```typescript
// Immediate response with background processing
Deno.serve(async (req) => {
  // ... validation and setup ...
  
  // Create a pending insight record immediately
  const { data: pendingInsight } = await supabase
    .from('member_insights')
    .insert({
      analysis_period,
      date_range_start,
      date_range_end,
      status: 'processing',  // New field
      created_by
    })
    .select()
    .single();
  
  // Start background processing
  EdgeRuntime.waitUntil(processAnalysis(supabase, pendingInsight.id, ...));
  
  // Return immediately
  return new Response(JSON.stringify({
    success: true,
    insight_id: pendingInsight.id,
    status: 'processing',
    message: 'Analysis started. You can navigate away - check back for results.'
  }));
});
```

### Frontend Changes

```typescript
const runAnalysis = async () => {
  setIsAnalyzing(true);
  try {
    const { data, error } = await supabase.functions.invoke('analyze-member-insights', {...});
    
    if (data.status === 'processing') {
      toast.info('Analysis started! This may take a few minutes. You can navigate away.');
      // Start polling or just refresh on next page visit
      pollForCompletion(data.insight_id);
    }
  } finally {
    setIsAnalyzing(false);
  }
};

const pollForCompletion = async (insightId: string) => {
  // Poll every 10 seconds until complete
  const interval = setInterval(async () => {
    const { data } = await supabase
      .from('member_insights')
      .select('status, total_calls_analyzed')
      .eq('id', insightId)
      .single();
    
    if (data?.status === 'completed') {
      clearInterval(interval);
      toast.success(`Analysis complete! Analyzed ${data.total_calls_analyzed} calls`);
      fetchInsights(); // Refresh the list
    } else if (data?.status === 'failed') {
      clearInterval(interval);
      toast.error('Analysis failed');
    }
  }, 10000);
};
```

### Database Migration

Add a `status` column to the `member_insights` table:

```sql
ALTER TABLE member_insights 
ADD COLUMN status text DEFAULT 'completed' 
CHECK (status IN ('processing', 'completed', 'failed'));

-- Mark existing records as completed
UPDATE member_insights SET status = 'completed' WHERE status IS NULL;
```

---

## Benefits

1. **No more interrupted analysis** - The edge function continues running even if you navigate away
2. **Better UX** - Users see immediate feedback and can continue working
3. **Resilient** - Analysis completes regardless of browser state
4. **Progress visibility** - Can check status on return to the page

## Estimated Effort

- Database migration: 1 minute
- Edge function refactor: 10 minutes
- Frontend polling logic: 10 minutes
- Testing: 5 minutes
