
# Update compare-llm-providers Edge Function for Prompt Enhancement Injection

## Overview

Modify the `compare-llm-providers` edge function to fetch and inject provider-specific prompt enhancements from the `llm_prompt_enhancements` table before calling DeepSeek. This enables accurate A/B testing to validate whether the enhanced prompts improve DeepSeek's readiness detection alignment with Gemini.

## Current State

The edge function uses a static `buildAnalysisPrompt()` function that returns the same system prompt for both providers. The `llm_prompt_enhancements` table contains 3 active DeepSeek enhancements:
- **few_shot_examples** (priority 10): 4 readiness classification examples
- **negative_signals** (priority 8): Complaint keywords and issue patterns
- **scoring_rubric** (priority 5): Explicit LOW/MEDIUM/HIGH scoring rules

## Implementation

### Changes to `supabase/functions/compare-llm-providers/index.ts`

**1. Add helper function to fetch prompt enhancements:**

```typescript
async function getProviderPromptEnhancements(
  supabase: any,
  providerName: 'deepseek' | 'lovable_ai'
): Promise<string> {
  const { data: enhancements } = await supabase
    .from('llm_prompt_enhancements')
    .select('content, enhancement_type')
    .eq('provider_name', providerName)
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (!enhancements || enhancements.length === 0) return '';

  return enhancements.map(e => e.content).join('\n\n');
}
```

**2. Modify the comparison logic to use enhanced prompts for DeepSeek:**

```typescript
// Build base prompts
const { system: baseSystem, user: userPrompt } = buildAnalysisPrompt(transcription);

// Fetch DeepSeek-specific enhancements
const deepseekEnhancements = await getProviderPromptEnhancements(supabase, 'deepseek');

// Create enhanced system prompt for DeepSeek
const deepseekSystemPrompt = deepseekEnhancements 
  ? `${deepseekEnhancements}\n\n${baseSystem}`
  : baseSystem;

// Run both providers in parallel with different prompts
const [geminiResult, deepseekResult] = await Promise.all([
  callGemini(baseSystem, userPrompt),           // Gemini uses base prompt
  callDeepSeek(deepseekSystemPrompt, userPrompt) // DeepSeek uses enhanced prompt
]);
```

**3. Track enhancement usage in comparison results:**

Add metadata to the stored comparison record:
```typescript
.insert({
  // ... existing fields
  deepseek_prompt_enhanced: !!deepseekEnhancements,
  deepseek_enhancements_used: deepseekEnhancements ? deepseekEnhancements.substring(0, 2000) : null,
})
```

**4. Include enhancement status in response:**

```typescript
return new Response(JSON.stringify({
  // ... existing fields
  deepseek: {
    // ... existing fields
    promptEnhanced: !!deepseekEnhancements,
  },
}));
```

## Database Changes

Add columns to `llm_quality_comparisons` table to track enhancement usage:

```sql
ALTER TABLE llm_quality_comparisons
ADD COLUMN IF NOT EXISTS deepseek_prompt_enhanced boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS deepseek_enhancements_used text;
```

## Testing Plan

After deployment:
1. Run comparison on Kenneth Pickett - verify `promptEnhanced: true` in response
2. Confirm DeepSeek returns "low" or "medium" readiness (aligned with Gemini)
3. Check `llm_quality_comparisons` table for `deepseek_prompt_enhanced = true`

## File Changes Summary

| File | Change |
|------|--------|
| `supabase/functions/compare-llm-providers/index.ts` | Add `getProviderPromptEnhancements()`, modify prompt injection logic, update response |
| Migration | Add `deepseek_prompt_enhanced` and `deepseek_enhancements_used` columns |
