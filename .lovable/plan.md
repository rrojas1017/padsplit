

# Improve DeepSeek Readiness Detection with Prompt Engineering

## Problem Analysis

Based on the 5 LLM comparison tests, DeepSeek consistently **overestimates moveInReadiness**:

| Member | Status | Gemini | DeepSeek | Issue |
|--------|--------|--------|----------|-------|
| Tiffany Andrews | Booking (issue call) | **low** | high | ❌ Major mismatch |
| Contact Automation | Non Booking | medium | high | ❌ Mismatch |
| (404) 595-9970 | Non Booking | medium | high | ❌ Mismatch |
| Travis Beckett | Non Booking | low | low | ✅ Match |

**Root Cause**: DeepSeek defaults to "high" readiness unless explicitly taught what low/medium looks like. The current prompt lacks:
1. Few-shot examples of negative scenarios
2. Explicit scoring rubric for readiness levels
3. Provider-specific calibration instructions

## Solution: Enhanced Provider-Specific Prompting

We will create a **prompt enhancement system** that adds few-shot examples and explicit instructions specifically for DeepSeek, stored in the database for easy tuning.

---

## Implementation Details

### Phase 1: Database - Add Prompt Enhancement Configuration

Create a new table `llm_prompt_enhancements` to store provider-specific prompt additions:

```sql
CREATE TABLE llm_prompt_enhancements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name text NOT NULL, -- 'deepseek' or 'lovable_ai'
  enhancement_type text NOT NULL, -- 'few_shot_examples', 'scoring_rubric', 'negative_signals'
  content text NOT NULL, -- The actual prompt content to inject
  priority int DEFAULT 0, -- Higher priority = earlier in prompt
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Initial Data** - Add few-shot examples for DeepSeek:

```sql
INSERT INTO llm_prompt_enhancements (provider_name, enhancement_type, content, priority) VALUES
-- Few-shot examples for readiness detection
('deepseek', 'few_shot_examples', E'
READINESS CLASSIFICATION EXAMPLES - Study these carefully:

EXAMPLE 1 - LOW READINESS (Issue/Complaint Call):
Transcript snippet: "I booked a room and paid money but there is an issue with my service dog. I need to talk to someone about getting my money back."
Analysis: moveInReadiness = "low" 
Why: Member is NOT trying to book - they are complaining about an existing issue and may want a refund.

EXAMPLE 2 - LOW READINESS (Just Browsing):
Transcript snippet: "I was just calling to see what you all have available. I am not ready to move yet, maybe in a few months."
Analysis: moveInReadiness = "low"
Why: Member explicitly states no urgency, timeline is months away.

EXAMPLE 3 - MEDIUM READINESS (Interested but Exploring):
Transcript snippet: "I found a listing online and wanted to know more about it. What are the requirements? My budget is around $200 a week."
Analysis: moveInReadiness = "medium"
Why: Member shows interest, has budget, but is still gathering information, no specific timeline.

EXAMPLE 4 - HIGH READINESS (Ready to Move):
Transcript snippet: "I need to move by this weekend. I have my deposit ready and just need to find a room near downtown Atlanta."
Analysis: moveInReadiness = "high"
Why: Urgent timeline (this weekend), has funds ready, specific location preference.
', 10),

-- Explicit scoring rubric
('deepseek', 'scoring_rubric', E'
MOVE-IN READINESS SCORING RULES (CRITICAL - Follow exactly):

Score LOW if ANY of these are true:
- Member is calling about an EXISTING booking issue (complaints, refunds, service dog problems)
- Member says "just looking", "not ready yet", "few months", "next year"
- Member is upset/frustrated about a previous interaction
- Call is an issue resolution, not a sales inquiry
- No timeline mentioned AND no urgency indicators

Score MEDIUM if:
- Member is actively exploring options but no immediate timeline
- Has budget but is comparing with other options
- Interested but needs to check with someone else
- Wants more information before committing

Score HIGH only if ALL of these are true:
- Member has urgent need (this week, ASAP, immediate)
- Has budget confirmed or deposit ready
- Is the decision maker
- Actively asking about booking process or next steps
', 5),

-- Negative sentiment signals
('deepseek', 'negative_signals', E'
NEGATIVE CALL INDICATORS (When detected, readiness should usually be LOW or MEDIUM):

COMPLAINT KEYWORDS: "issue", "problem", "refund", "money back", "cancel", "frustrated", "upset", "not what I expected"

ISSUE CALL PATTERNS:
- Member already booked/paid and is having problems
- Discussing service animals, accessibility issues, or policy violations
- Agent is apologizing or explaining policies defensively
- Member wants to speak to a manager or escalate

When these patterns appear, the call is NOT a sales opportunity - it is issue resolution. 
Mark as LOW readiness regardless of other factors.
', 8);
```

### Phase 2: Modify Edge Functions - Apply Enhancements

Update `transcribe-call/index.ts` and `reanalyze-call/index.ts`:

**New Helper Function:**
```typescript
async function getProviderPromptEnhancements(
  supabase: any, 
  providerName: 'deepseek' | 'lovable_ai'
): Promise<string> {
  const { data: enhancements } = await supabase
    .from('llm_prompt_enhancements')
    .select('content')
    .eq('provider_name', providerName)
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (!enhancements || enhancements.length === 0) return '';

  return enhancements.map(e => e.content).join('\n\n');
}
```

**Inject Before DeepSeek Calls:**
```typescript
// When calling DeepSeek, add provider-specific enhancements
if (selectedProvider.provider === 'deepseek') {
  const enhancements = await getProviderPromptEnhancements(supabase, 'deepseek');
  systemPrompt = enhancements + '\n\n' + systemPrompt;
}
```

### Phase 3: UI - Prompt Enhancement Editor

Add a new section in `LLMComparisonPanel.tsx` for managing prompt enhancements:

**New UI Elements:**
- "Prompt Tuning" accordion section
- Table showing current enhancements for DeepSeek
- Edit dialog for modifying enhancement content
- Toggle to enable/disable each enhancement
- "Test Enhancement" button to run a comparison with the modified prompt

---

## File Changes Summary

| File | Changes |
|------|---------|
| New migration | Create `llm_prompt_enhancements` table with initial data |
| `supabase/functions/transcribe-call/index.ts` | Add `getProviderPromptEnhancements`, inject before DeepSeek calls |
| `supabase/functions/reanalyze-call/index.ts` | Same enhancement injection logic |
| `src/components/ai-management/LLMComparisonPanel.tsx` | Add Prompt Tuning UI section |

---

## Why This Approach Works

1. **Few-shot learning** teaches DeepSeek by example - showing what LOW/MEDIUM/HIGH actually looks like in PadSplit context

2. **Explicit scoring rubric** overrides DeepSeek's tendency to default to "high" by giving clear rules

3. **Database-driven** allows tuning prompts without code deployments - you can add more examples as you discover edge cases

4. **Provider-specific** - only DeepSeek gets the extra guidance, so Gemini's behavior is unchanged

---

## Expected Improvement

After implementing, DeepSeek should:
- Correctly identify issue/complaint calls as LOW readiness
- Match Gemini's readiness detection in 90%+ of cases
- Save ~31% on LLM costs while maintaining quality parity

---

## Testing Plan

1. Run LLM comparison on **Tiffany Andrews** (the issue call) - verify DeepSeek now returns "low"
2. Run comparison on **Contact Automation** - verify medium/low instead of high
3. Run 5 additional comparisons to validate no regression on standard booking calls

