
# Plan: Add Call Length Threshold for AI Model Selection

Implement a smart model selector that uses **Gemini 2.5 Flash** for short calls (under 5 minutes) and **Gemini 2.5 Pro** for longer calls. This optimization will reduce AI analysis costs by ~60-70% on shorter calls while maintaining quality for longer, more complex conversations.

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| Short calls (<5 min) | Gemini 2.5 Pro (~$0.04) | Gemini 2.5 Flash (~$0.01) |
| Long calls (≥5 min) | Gemini 2.5 Pro (~$0.04) | Gemini 2.5 Pro (~$0.04) |
| Estimated savings | - | ~40-50% on AI analysis costs |

---

## Implementation

### 1. Create Model Selection Helper Function

Add a reusable function to determine the appropriate model based on call duration:

```text
selectAnalysisModel(callDurationSeconds)
├── If callDurationSeconds < 300 (5 min)
│   └── Return 'google/gemini-2.5-flash'
└── Else
    └── Return 'google/gemini-2.5-pro'
```

### 2. Update transcribe-call Edge Function

**File:** `supabase/functions/transcribe-call/index.ts`

Modify the AI analysis step (around line 1298-1335) to:
- Use `callDurationSeconds` (already available from STT result) to select model
- Update the cost logging to reflect the actual model used
- Add logging to track model selection

```text
Before:
  model: 'google/gemini-2.5-pro'  (hardcoded)

After:
  const analysisModel = callDurationSeconds && callDurationSeconds < 300 
    ? 'google/gemini-2.5-flash' 
    : 'google/gemini-2.5-pro';
  model: analysisModel  (dynamic)
```

### 3. Update reanalyze-call Edge Function

**File:** `supabase/functions/reanalyze-call/index.ts`

Modify the `performAIAnalysisWithRetry` function (around line 350-400) to:
- Accept `callDurationSeconds` as a parameter
- Select model based on duration threshold
- Update cost logging metadata

The booking query already fetches `call_duration_seconds`, so this is readily available.

### 4. Update Cost Logging for Accuracy

Update the `logApiCost` function in both files to use correct model-aware pricing:

```text
Model Pricing (per 1M tokens):
┌─────────────────────┬──────────────┬───────────────┐
│ Model               │ Input Rate   │ Output Rate   │
├─────────────────────┼──────────────┼───────────────┤
│ gemini-2.5-flash    │ $0.30        │ $2.50         │
│ gemini-2.5-pro      │ $1.25        │ $10.00        │
└─────────────────────┴──────────────┴───────────────┘
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/transcribe-call/index.ts` | Add model selection logic based on duration, update AI call and cost logging |
| `supabase/functions/reanalyze-call/index.ts` | Pass duration to AI function, implement model selection, update cost logging |

---

## Technical Details

### Model Selection Function

```typescript
function selectAnalysisModel(callDurationSeconds: number | null): string {
  const DURATION_THRESHOLD_SECONDS = 300; // 5 minutes
  
  if (!callDurationSeconds || callDurationSeconds < DURATION_THRESHOLD_SECONDS) {
    console.log(`[Model] Using Flash for ${callDurationSeconds || 0}s call (< 5 min threshold)`);
    return 'google/gemini-2.5-flash';
  }
  
  console.log(`[Model] Using Pro for ${callDurationSeconds}s call (≥ 5 min threshold)`);
  return 'google/gemini-2.5-pro';
}
```

### Cost Logging Update

The existing `logApiCost` function already has model-aware pricing logic, but it needs to correctly handle the Flash model rates:

```typescript
if (model.includes('gemini-2.5-pro')) {
  inputRate = 0.00000125;  // $1.25 per 1M tokens
  outputRate = 0.00001;    // $10.00 per 1M tokens
} else if (model.includes('gemini-2.5-flash') && !model.includes('lite')) {
  inputRate = 0.0000003;   // $0.30 per 1M tokens
  outputRate = 0.0000025;  // $2.50 per 1M tokens
}
```

---

## Expected Impact

### Cost Savings Estimate

Based on current PadSplit call distribution (estimated):
- ~60% of calls are under 5 minutes
- ~40% of calls are 5 minutes or longer

| Metric | Before | After | Savings |
|--------|--------|-------|---------|
| Short call AI cost | ~$0.04 | ~$0.01 | 75% |
| Long call AI cost | ~$0.04 | ~$0.04 | 0% |
| **Blended average** | **$0.04** | **$0.022** | **~45%** |

For the current bulk job processing ~4,600 calls:
- Before: ~$184 in AI analysis costs
- After: ~$101 in AI analysis costs
- **Estimated savings: ~$83**

### Quality Considerations

- **Flash is highly capable** for structured extraction (summaries, member details, coaching feedback)
- **Pro reserved for complex calls** where nuanced understanding matters (longer conversations, multiple topics, complex objections)
- The 5-minute threshold is a reasonable starting point and can be tuned later based on quality feedback
