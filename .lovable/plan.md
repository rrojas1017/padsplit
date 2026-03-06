

## Improve Research Classification Accuracy

### Problem
Three issues causing inaccurate categorization:
1. **Prompt A's "STATED vs TRUE REASON GUIDE"** forces the AI to reinterpret what members said — e.g., "I found an apartment" gets reclassified as "Host Negligence" even without evidence
2. **No confidence threshold** — a single casual mention of an issue gets the same weight as a repeated, emphasized complaint
3. **Prompt B only sees the extraction** — it cannot verify whether Prompt A's interpretation matches the actual transcript

### Changes

**File: `supabase/functions/process-research-record/index.ts`**

**1. Remove over-interpretation bias from Prompt A (DEFAULT_EXTRACTION_PROMPT)**
- Delete the entire "STATED vs TRUE REASON GUIDE" block (lines 193-199)
- Replace `primary_reason_interpreted` instruction from "Your analytical interpretation of the TRUE root cause" to: "If you believe the stated reason may not be the full picture, explain why based on EVIDENCE from the transcript. If there is no contradicting evidence, set this to null."
- Add rule: "Do NOT assume hidden motivations. Only flag an interpreted reason when the transcript contains concrete contradicting evidence."

**2. Add confidence thresholds to Prompt A extraction**
- Add a `mention_count` field to each item in `issues_mentioned`: how many distinct times the member referenced this issue
- Add an `evidence_strength` field: `"strong"` (member explicitly identifies as reason for leaving), `"moderate"` (discussed at length or with emotion), `"weak"` (mentioned once in passing or only by agent)
- Add rule: "Mark evidence_strength as 'weak' for issues mentioned only once, casually, or only raised by the agent. Mark 'strong' only when the member explicitly connects the issue to their decision to leave."

**3. Feed raw transcript to Prompt B for verification**
- Change the Prompt B user message from just the extraction JSON to include both the extraction AND the raw transcript
- Update `DEFAULT_CLASSIFICATION_PROMPT` to add verification rules:
  - "You are receiving BOTH the structured extraction AND the original transcript. Cross-reference the extraction against the transcript."
  - "If the extraction's `primary_reason_interpreted` contradicts what the member actually said, override it using the transcript as ground truth."
  - "Only use issues with evidence_strength 'strong' or 'moderate' when determining the primary_reason_code. Issues with 'weak' evidence should only appear in secondary_reason_codes."
  - "Lower the preventability_score by 2 points if the primary reason is based on interpretation rather than explicit member statements."

**4. Update the Prompt B call** (line 372)
- Change the user prompt from:
  `Here is the structured extraction to classify:\n\n${JSON.stringify(extraction, null, 2)}`
- To:
  `Here is the structured extraction to classify:\n\n${JSON.stringify(extraction, null, 2)}\n\n--- ORIGINAL TRANSCRIPT FOR VERIFICATION ---\n\n${transcription.call_transcription}`

This is a single-file change to the edge function. Existing processed records are unaffected — only new/re-processed records will use the improved prompts. Custom prompts in the `research_prompts` table will continue to override these defaults.

