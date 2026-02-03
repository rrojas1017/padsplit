
## Fix: Handle AI Parsing Failures with Retry and Proper Error Status

This plan addresses the issue where the "This Month" Booking Insights analysis completed but returned empty results due to an unparsable AI response.

### Summary

When the AI model returns a response without valid JSON, the system currently:
1. Logs an error but continues
2. Uses empty arrays for all fields
3. Marks the analysis as "completed"
4. Shows users empty charts with no explanation

### Changes

**Phase 1: Add Retry Logic for Failed AI Responses**

**File: `supabase/functions/analyze-member-insights/index.ts`**

Wrap the AI call in a retry loop (up to 2 retries) when JSON parsing fails:

```typescript
// Around lines 442-508
let parsedAnalysis;
let retryCount = 0;
const maxRetries = 2;

while (retryCount <= maxRetries) {
  const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    // ... existing fetch config
  });
  
  const aiData = await aiResponse.json();
  const analysisText = aiData.choices?.[0]?.message?.content || '';
  
  try {
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsedAnalysis = JSON.parse(jsonMatch[0]);
      break; // Success - exit retry loop
    } else {
      throw new Error('No JSON found in response');
    }
  } catch (parseError) {
    retryCount++;
    console.error(`[Background] JSON parse failed (attempt ${retryCount}/${maxRetries + 1}):`, parseError);
    
    if (retryCount > maxRetries) {
      // All retries exhausted - mark as failed
      throw new Error('AI returned invalid response after multiple attempts');
    }
    
    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
```

**Phase 2: Mark Failed Analyses Properly**

**File: `supabase/functions/analyze-member-insights/index.ts`**

When retries are exhausted, mark the record as `status: 'failed'` instead of completing with empty data:

- Remove the fallback that sets empty arrays (lines 496-507)
- Throw an error instead, which triggers the existing error handler (lines 615-627)
- The error handler already updates status to 'failed' with an error message

**Phase 3: Add Validation Before Saving**

**File: `supabase/functions/analyze-member-insights/index.ts`**

Before marking as completed, verify that at least some insights were extracted:

```typescript
// Before the update at line 582
const hasAnyInsights = 
  (parsedAnalysis.pain_points?.length > 0) ||
  (parsedAnalysis.objection_patterns?.length > 0) ||
  (parsedAnalysis.ai_recommendations?.length > 0) ||
  (parsedAnalysis.customer_journeys?.length > 0);

if (!hasAnyInsights && totalCalls > 0) {
  throw new Error('AI analysis returned no insights from available data');
}
```

**Phase 4: UI - Show Failed Status to Users**

**File: `src/components/call-insights/BookingInsightsTab.tsx`**

Add handling for `status: 'failed'` insights:

```typescript
// In the insights display section
{selectedInsight?.status === 'failed' && (
  <Card className="border-red-500/50 bg-red-500/5">
    <CardContent className="py-4">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-red-500" />
        <div>
          <p className="font-medium">Analysis failed</p>
          <p className="text-sm text-muted-foreground">
            {selectedInsight.error_message || 'The AI was unable to process this data. Please try again.'}
          </p>
        </div>
        <Button size="sm" onClick={runAnalysis}>Retry</Button>
      </div>
    </CardContent>
  </Card>
)}
```

**Phase 5: Improve AI Prompt for Small Datasets**

**File: `supabase/functions/analyze-member-insights/index.ts`**

Add instructions for handling smaller datasets:

```typescript
// Add to the AI prompt (around line 324)
const promptSuffix = totalCalls < 30 
  ? `\n\nNOTE: This is a smaller dataset (${totalCalls} calls). Still provide analysis with the data available - do not skip categories. If there isn't enough data for a category, include it with an empty array. ALWAYS return valid JSON.`
  : '';
```

Also add explicit JSON formatting instruction:

```typescript
// Before the closing of the prompt
CRITICAL: Your response must start with { and end with }. Return ONLY the JSON object, no explanations or markdown.
```

### Expected Behavior After Fix

1. **When AI returns invalid response:**
   - System retries up to 2 times with 2-second delays
   - If all retries fail, status is set to 'failed' with error message

2. **When analysis has no insights:**
   - System marks as 'failed' instead of 'completed'
   - Error message explains what went wrong

3. **In the UI:**
   - Failed analyses show a red warning banner with "Retry" button
   - Users understand why their results are empty
   - Easy one-click retry without re-selecting options

### Technical Notes

- Retry adds up to 4 seconds latency in worst case (2 retries x 2 seconds)
- Failed analyses are preserved in history so users can see what happened
- Improved prompt reduces likelihood of non-JSON responses
