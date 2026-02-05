
# Hybrid LLM Implementation Plan

## Overview

This plan implements a hybrid LLM strategy where **DeepSeek is the default provider** for cost efficiency (~41% savings), but **Gemini is used as a fallback** for scenarios where DeepSeek showed quality gaps in testing:

1. **Non-booking calls** (status = "Non Booking")
2. **Calls with negative sentiment detected** (requires two-pass analysis)

The approach balances cost savings with quality assurance, using the established A/B testing pattern from `llm_provider_settings`.

---

## Architecture

```text
                      ┌─────────────────────────┐
                      │    Incoming Call        │
                      │    (transcribe-call)    │
                      └───────────┬─────────────┘
                                  │
                      ┌───────────▼─────────────┐
                      │  Check LLM Provider     │
                      │  Settings (weights)     │
                      └───────────┬─────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
         DeepSeek 100%      Mixed Weights       Gemini 100%
              │                   │                   │
              ▼                   ▼                   ▼
    ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
    │  Is Non-Booking?│   │  Random Select  │   │  Use Gemini     │
    │       OR        │   │  per Weights    │   │  Directly       │
    │  Negative Call? │   └─────────────────┘   └─────────────────┘
    └────────┬────────┘
             │
      ┌──────┴──────┐
      │ YES         │ NO
      ▼             ▼
  Use Gemini    Use DeepSeek
  (Fallback)    (Default)
```

---

## Implementation Steps

### Phase 1: Database Update - Add Fallback Configuration

Update the `llm_provider_settings` table to include hybrid mode options:

**Modify `api_config` for `deepseek` provider:**
```json
{
  "model": "deepseek-chat",
  "use_gemini_fallback_for": ["non_booking", "negative_sentiment"],
  "enable_two_pass_sentiment": true
}
```

This configuration allows:
- `non_booking`: Always use Gemini for calls where `status = 'Non Booking'`
- `negative_sentiment`: Use two-pass analysis (DeepSeek first, then Gemini if sentiment is negative)
- The array can be modified in the database without code changes

---

### Phase 2: Create Hybrid LLM Selection Logic

Create a new helper module that both `transcribe-call` and `reanalyze-call` will use:

**New Logic Flow:**
1. Fetch current weights from `llm_provider_settings`
2. If DeepSeek weight is 0, use Gemini directly
3. If Gemini weight is 0, check for fallback conditions:
   - If booking is "Non Booking" → Use Gemini
   - Otherwise → Use DeepSeek
4. For sentiment fallback (optional two-pass):
   - First pass: Quick DeepSeek call
   - If negative sentiment detected → Re-run with Gemini
   - Store both results for comparison data

---

### Phase 3: Modify transcribe-call Edge Function

**Key Changes to `supabase/functions/transcribe-call/index.ts`:**

1. **Add new helper function: `selectLLMProvider`**
   - Reads `llm_provider_settings` table
   - Considers booking status (Non Booking vs regular)
   - Returns `{ provider: 'deepseek' | 'lovable_ai', model: string, fallbackReason?: string }`

2. **Add DeepSeek API call function: `callDeepSeekForAnalysis`**
   - Similar to existing Gemini call pattern
   - Uses `DEEPSEEK_API_KEY` secret
   - Handles JSON response parsing

3. **Modify the AI analysis step (around line 1312-1400)**
   - Replace direct Gemini call with provider selection logic
   - Add cost logging for the selected provider
   - Store `llm_provider` in `booking_transcriptions` metadata for tracking

4. **Add optional two-pass sentiment fallback**
   - If enabled and DeepSeek returns `negative` sentiment
   - Re-run analysis with Gemini
   - Log both costs for comparison

---

### Phase 4: Modify reanalyze-call Edge Function

**Key Changes to `supabase/functions/reanalyze-call/index.ts`:**

Apply the same hybrid selection logic:
1. Add `selectLLMProvider` function (shared pattern)
2. Add `callDeepSeekForAnalysis` function
3. Update `callAIWithRetry` to use the selected provider
4. Log the provider used in cost tracking

---

### Phase 5: Add Provider Tracking to booking_transcriptions

Add a new column to track which LLM was used:

**Migration SQL:**
```sql
ALTER TABLE booking_transcriptions 
ADD COLUMN IF NOT EXISTS llm_provider text DEFAULT 'lovable_ai';

COMMENT ON COLUMN booking_transcriptions.llm_provider IS 
  'LLM provider used for analysis: lovable_ai (Gemini), deepseek';
```

This enables:
- Quality audits by provider
- A/B performance comparison
- Rollback analysis if issues arise

---

### Phase 6: Update Provider Labels

The provider labels are already configured in `src/utils/providerLabels.ts` from the previous DeepSeek comparison implementation.

---

### Phase 7: Add Settings UI Control

Add a toggle in the LLM Comparison Panel to enable/disable hybrid mode:

**New UI Elements:**
- "Hybrid Mode" toggle (updates `llm_provider_settings.api_config`)
- Dropdown to select fallback conditions
- Real-time stats showing provider distribution

---

## Files to Create

| File | Purpose |
|------|---------|
| None | All logic embedded in existing edge functions |

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/transcribe-call/index.ts` | Add hybrid LLM selection, DeepSeek API call, provider tracking |
| `supabase/functions/reanalyze-call/index.ts` | Add hybrid LLM selection, DeepSeek API call, provider tracking |
| `src/components/ai-management/LLMComparisonPanel.tsx` | Add hybrid mode toggle and configuration UI |

## Database Migrations

1. Add `llm_provider` column to `booking_transcriptions`
2. Update `deepseek` provider's `api_config` with fallback settings

---

## Cost Impact Analysis

Based on the 5 comparison tests:

| Scenario | Provider | Est. Monthly Calls | Current Cost | New Cost | Savings |
|----------|----------|-------------------|--------------|----------|---------|
| Standard Bookings | DeepSeek | ~800 | ~$16 | ~$9.50 | ~41% |
| Non-Booking Calls | Gemini | ~200 | ~$4 | ~$4 | 0% |
| Negative Sentiment | Gemini | ~50 (est.) | ~$1 | ~$1 | 0% |
| **Total** | Mixed | 1,050 | ~$21 | ~$14.50 | **~31%** |

The hybrid approach maintains quality for edge cases while capturing ~75% of the theoretical DeepSeek savings.

---

## Technical Details

### DeepSeek API Call Pattern

```typescript
async function callDeepSeekForAnalysis(
  systemPrompt: string,
  userPrompt: string
): Promise<{
  analysis: any;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}> {
  const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');
  if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not configured');

  const startTime = Date.now();
  
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      stream: false,
    }),
  });

  // ... response parsing logic
}
```

### Provider Selection Logic

```typescript
interface LLMProviderSelection {
  provider: 'deepseek' | 'lovable_ai';
  model: string;
  fallbackReason?: string;
}

async function selectLLMProvider(
  supabase: any,
  bookingStatus: string | null,
  callDurationSeconds: number | null
): Promise<LLMProviderSelection> {
  // Fetch LLM provider settings
  const { data: settings } = await supabase
    .from('llm_provider_settings')
    .select('provider_name, weight, api_config')
    .eq('is_active', true);

  const deepseekSettings = settings?.find(s => s.provider_name === 'deepseek');
  const geminiSettings = settings?.find(s => s.provider_name === 'lovable_ai');

  // Check fallback conditions
  const fallbackConditions = deepseekSettings?.api_config?.use_gemini_fallback_for || [];
  const isNonBooking = bookingStatus === 'Non Booking';

  if (isNonBooking && fallbackConditions.includes('non_booking')) {
    return {
      provider: 'lovable_ai',
      model: selectAnalysisModel(callDurationSeconds),
      fallbackReason: 'non_booking'
    };
  }

  // Weight-based selection
  const deepseekWeight = deepseekSettings?.weight || 0;
  const geminiWeight = geminiSettings?.weight || 100;
  const totalWeight = deepseekWeight + geminiWeight;

  if (totalWeight === 0 || deepseekWeight === 0) {
    return {
      provider: 'lovable_ai',
      model: selectAnalysisModel(callDurationSeconds)
    };
  }

  if (geminiWeight === 0) {
    return {
      provider: 'deepseek',
      model: 'deepseek-chat'
    };
  }

  // Random selection based on weights
  const random = Math.random() * totalWeight;
  if (random < deepseekWeight) {
    return { provider: 'deepseek', model: 'deepseek-chat' };
  }

  return {
    provider: 'lovable_ai',
    model: selectAnalysisModel(callDurationSeconds)
  };
}
```

---

## Rollback Strategy

If DeepSeek shows issues in production:
1. Set `deepseek.weight = 0` in `llm_provider_settings` (immediate)
2. Gemini becomes 100% of traffic
3. Analyze `booking_transcriptions.llm_provider` to identify affected records
4. Batch re-analyze with Gemini using existing `batch-reanalyze-coaching` pattern

---

## Success Metrics

After 1 week of hybrid operation:
1. **Cost savings** ≥ 25% overall LLM costs
2. **Quality parity**: No increase in coaching feedback complaints
3. **Sentiment accuracy**: Gemini fallback triggers on ≥ 95% of actual negative calls
4. **Non-booking accuracy**: Buyer intent scores remain consistent with pre-hybrid baseline

