

## Re-Process All Existing Research Records with Updated Prompts

### What needs to happen
All previously processed research records need to be reset and re-run through the updated Prompt A (no over-interpretation) and Prompt B (with transcript verification + confidence thresholds) so historical data reflects accurate classifications.

### Approach

**1. Add a "Reprocess All" button to the Research Insights UI**
- File: `src/pages/research/ResearchInsights.tsx` (or wherever the "Process All" button lives)
- Add a new button labeled "Reprocess All Records" next to the existing "Process All" button
- This button calls a new `triggerReprocess` function

**2. Add `triggerReprocess` to `useResearchInsightsData.ts`**
- New function that:
  1. Resets all `booking_transcriptions` records that have `research_processing_status = 'completed'` back to `null` (clearing `research_extraction`, `research_classification`, `research_processed_at` as well)
  2. Then invokes `batch-process-research-records` to kick off reprocessing
- This uses an edge function call since the client can't bulk-update these fields (RLS restricts agent updates)

**3. Create edge function `reset-research-processing`**
- File: `supabase/functions/reset-research-processing/index.ts`
- Accepts optional `campaignId` filter
- Uses service role to bulk-update `booking_transcriptions`:
  - Set `research_processing_status = null`
  - Set `research_extraction = null`
  - Set `research_classification = null`  
  - Set `research_processed_at = null`
- Only resets records where `research_processing_status = 'completed'` and the parent booking is `record_type = 'research'`
- Returns count of reset records
- After reset, auto-invokes `batch-process-research-records` to start the pipeline

**4. UI confirmation**
- Show a confirmation dialog before resetting ("This will reprocess X records with updated AI prompts. Continue?")
- Use the existing dry-run endpoint to get the total count for the confirmation message
- After confirmation, show toast and start the existing polling mechanism

### Files to create/modify
- **Create**: `supabase/functions/reset-research-processing/index.ts`
- **Modify**: `src/hooks/useResearchInsightsData.ts` — add `triggerReprocess` function
- **Modify**: Research Insights page/component — add "Reprocess All" button with confirmation dialog

