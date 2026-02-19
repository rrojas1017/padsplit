
## Move-Out Script: Conditional Branching & Smart Jump Navigation

### What the Document Actually Requires (That Is Currently Missing)

After fully reading both versions of the document, the answer to your question is: **No, the current wizard does not support probing questions or conditional branching at all.** The existing `LogSurveyCall.tsx` is a flat, linear sequence — every question appears in the same order for every call, with no branching.

The document is built almost entirely on conditional logic:

**Critical branching points in the script:**

| Question | Member says YES | Member says NO |
|---|---|---|
| "Did you consider transferring?" | → Ask 4 follow-ups (What prevented? Was availability an issue? Was cost a factor? Was process clear?) | → Ask "Were you aware transfer was an option?" |
| "Did you request a payment extension?" | → Ask "How did that process feel?" | → Ask "Were you aware extensions might be available?" |
| "Did you reach out for help before deciding to move?" | → Continue to next section | → Capture as escalation gap (blind spot) |
| "If issue resolved, would you have stayed?" | → Flag as PREVENTABLE (High) | → Flag as NON-PREVENTABLE |
| Is reason life-event related? | → Classify Non-Addressable, skip preventability | → Continue to preventability assessment |

Additionally, the document has **probing follow-ups** that should surface under each main question — not as separate full screens, but as collapsible sub-prompts the researcher can tap to reveal and use naturally.

---

### What Needs to Be Built

**1. Conditional Branch Engine in `LogSurveyCall.tsx`**

Extend the `ScriptQuestion` type to support:
```typescript
interface ScriptQuestion {
  // existing fields
  probes?: string[];              // follow-up prompts shown below the main question
  branch?: {
    yes_goto?: number;            // question order to jump to on Yes answer
    no_goto?: number;             // question order to jump to on No answer  
    yes_probes?: string[];        // probing questions shown only if Yes
    no_probes?: string[];         // probing questions shown only if No
  };
  section?: string;               // e.g. "Transfer Exploration", "Payment Section"
  is_internal?: boolean;          // internal classification — shown differently (no "Read aloud" label)
  skip_if?: string;               // skip this question if a specific condition is met
}
```

The wizard navigation (`handleNext`) becomes branch-aware: after recording a `yes_no` answer, it checks `branch.yes_goto` or `branch.no_goto` to determine the next question index instead of blindly incrementing.

**2. "Jump to Section" Sidebar Panel**

A collapsible section navigator shown during the `question` phase — a vertical list of the script's 10 sections. Each section is clickable, allowing the researcher to jump directly to the first question of that section. This is critical for move-out calls where the conversation doesn't always follow a linear path (the member may jump straight to talking about payments, requiring the researcher to go directly to Section 6).

The panel appears as a fixed mini-sidebar on the right side of the question card (or as a drawer on mobile), showing:
```
✅ 1. Opening & Framing
✅ 2. Root Cause Discovery  
→ 3. Dig Deeper (current)
   4. Transfer Exploration
   5. Payment Section
   6. Experience Breakdown
   7. Preventability
   8. Life Event Check
   9. Improvement Capture
  10. Close the Call
```

Completed sections get a checkmark. The current section is highlighted. Clicking any section jumps the wizard to the first question in that section.

**3. Probing Sub-Prompts (Expandable Under Each Question)**

Below each main question card, a "Probing follow-ups" collapsible section shows the additional prompts from the document. The researcher taps a probe to "activate" it (highlights it so they remember to ask it). This replaces the need for separate screens for follow-up questions.

For example, under "What was the main reason you decided to move out?":
```
▼ Probing follow-ups (tap to use)
  [ ] "Was there a specific moment that triggered your decision?"
  [ ] "When did you first start thinking about moving?"
  [ ] "If nothing had changed, would you have stayed?"
  [ ] "What initially brought you to PadSplit?"
  [ ] "Was this mainly related to the host or operator?"
  [ ] "Was this mainly member related?"
```

**4. Conditional Answer Buttons (Yes/No Branch Routing)**

For `yes_no` questions that have conditional branches, the Yes and No buttons gain visual indicators showing where each answer leads:

```
[ ✓ YES → Transfer follow-ups ]   [ ✗ NO → "Were you aware?" ]
```

After the researcher clicks Yes or No, the system:
1. Records the answer
2. Shows the branch-specific probing questions for that answer inline
3. Auto-advances to the correct next question (`branch.yes_goto` or `branch.no_goto`)

**5. Updated `parse-research-script` Edge Function**

Switch to Claude (`anthropic/claude-opus-4-5` via Lovable AI gateway — available without API key as `openai/gpt-5` maps to the most capable model). Update the tool schema to extract:
- `probes: string[]` for each question
- `branch.yes_goto` / `branch.no_goto` (question order numbers)
- `branch.yes_probes` / `branch.no_probes`  
- `section: string` (which section of the script this question belongs to)
- `is_internal: boolean` (for researcher-only classification questions)

**6. Mandatory Setup Fields (from approved previous plan)**

As previously approved, the setup form will also get:
- First Name * + Last Name * (separate mandatory fields)
- Phone Number * (mandatory)
- Researcher badge (auto from `user.name`, read-only)

---

### Files to Create / Modify

**Modify:**
1. `src/pages/research/LogSurveyCall.tsx` — Add branch engine, section jump navigator, probing sub-prompts, conditional Yes/No routing, mandatory setup fields (first/last name, phone)
2. `supabase/functions/parse-research-script/index.ts` — Switch to Claude, update tool schema to extract `probes`, `branch`, `section`, `is_internal` per question
3. `src/hooks/useResearchCalls.ts` — Extend `ScriptQuestion` type with `probes`, `branch`, `section`, `is_internal`; add `_researcher_name`, `_caller_first_name`, `_caller_last_name` to responses at submit time

**Create:**
4. `src/components/research/SectionJumpNavigator.tsx` — The clickable section sidebar/panel shown during the question phase
5. `src/components/research/ProbingFollowUps.tsx` — Expandable collapsible list of probing prompts with tap-to-activate

---

### How the Branching UX Works (Transfer Example)

```
Screen: "Did you consider transferring to another PadSplit?"
[YES → Transfer follow-ups]        [NO → "Were you aware?"]

Researcher clicks YES →
  ↓ Reveals inline:
  ✦ "What prevented the transfer?"
  ✦ "Was availability an issue?"  
  ✦ "Was cost a factor?"
  ✦ "Was the process clear?"
  
  Then: → auto-advances to Section 6 (Payment)

Researcher clicks NO →
  ↓ Reveals inline:
  ✦ "Were you aware that transfer was an option?"
  
  Then: → auto-advances to Section 6 (Payment)
```

---

### No Database Migration Required

All new question fields (`probes`, `branch`, `section`, `is_internal`) are stored inside the existing `research_scripts.questions` JSONB array — no schema changes needed. The `research_calls.responses` JSONB stores `_researcher_name`, `_caller_first_name`, `_caller_last_name` as before.
