

## Remove Biased "STATED vs TRUE REASON GUIDE" from Extraction Prompt

### What changes
**File: `supabase/functions/process-research-record/index.ts`** (lines 193-199)

Replace the hardcoded bias guide:
```
STATED vs TRUE REASON GUIDE:
- "I couldn't find a job" → likely Payment Extension Not Offered
- "I found an apartment" → likely Host Negligence (apartment was escape, not cause)
...
```

With neutral discrepancy flagging instructions:
```
DISCREPANCY FLAGGING:
- Record the member's stated reason exactly as they expressed it in "primary_reason_stated".
- In "primary_reason_interpreted", note ONLY if other evidence in the transcript contradicts or complicates the stated reason. Cite the specific evidence.
- If no contradicting evidence exists, "primary_reason_interpreted" should match the stated reason.
- Do NOT assume hidden motivations. Flag discrepancies only when the transcript itself provides conflicting signals.
- Use "confidence_flags" to note any ambiguity rather than choosing an interpretation.
```

### Why
The current guide pre-supposes that members' stated reasons are wrong and maps them to specific PadSplit-attributable causes (e.g., "I found an apartment" → "Host Negligence"). This systematically inflates preventability scores and skews reason code distributions. The replacement ensures findings are evidence-based: interpretations only diverge from stated reasons when the transcript itself contains contradicting evidence.

### Scope
- Single block replacement in one file (~7 lines)
- Aligns with the memory note on research classification accuracy logic

