
## Replace PublicScriptView with an Interactive Wizard

### Problem
The external script link (`/script/:token`) currently renders all questions as a flat, static document. The user expects the same step-by-step wizard experience as the internal `ScriptTesterDialog`: one question at a time, interactive radio buttons, Yes/No branching, probing follow-ups revealed after a selection, Back/Next navigation, and a progress bar.

### Solution
Completely rewrite `src/pages/PublicScriptView.tsx` to replicate the `ScriptTesterDialog` flow as a full-page wizard (no dialog wrapper needed — it owns the whole page).

---

### Phase State Machine (mirrors ScriptTesterDialog exactly)

```text
start → intro → consent → question (0…N) → closing → done
                       ↘ rebuttal → done
```

- **start**: Script name, description, badges, "Begin" button
- **intro**: Full-width intro script card + Back / Next
- **consent**: "Did the caller agree to continue?" with Yes / No buttons
- **question**: One question per screen with interactive response input
- **closing**: Closing script card
- **rebuttal**: Rebuttal script card (if consent denied)
- **done**: Completion screen with a "Restart" option

---

### Per-Question Interaction (matching the internal tester)

| Question Type | Widget |
|---|---|
| `yes_no` | RadioGroup with Yes / No options |
| `multiple_choice` | RadioGroup listing each option |
| `scale` | Slider 1–10 |
| `open_ended` | Textarea (notes-optional label) |

**Branching**: After a `yes_no` question response is selected, show the relevant branch probes (yes_probes / no_probes) inline below the radio group before the user clicks Next.

**Probing follow-ups**: If a question has `probes`, show them in a highlighted box after the main question text (same as the tester).

---

### Progress Bar
Identical to the tester: total steps = questions + (intro ? 1 : 0) + 1 consent + (closing ? 1 : 0). Progress updates as the user advances.

---

### Layout Changes
- **Header**: Sticky top bar with PadSplit logo, script name, campaign/audience badges — keep this.
- **Body**: Replace the static content area with the wizard card (max-w-lg, centered, card-style with shadow, rounded-xl) matching the dialog style from the tester.
- **Footer**: Show "PadSplit Operations · External View" below the card.
- No authentication required — same as now.

---

### Files Changed

| File | Change |
|---|---|
| `src/pages/PublicScriptView.tsx` | Full rewrite — replace static document with interactive wizard |

No backend changes needed. The `validate-script-token` edge function already returns all question data including `branch`, `probes`, `options`, `type`, `section` etc.

---

### Key Implementation Details

- Import `RadioGroup`, `RadioGroupItem`, `Label`, `Slider`, `Textarea`, `Progress`, `Button` from existing UI components
- The `phase` state and `questionIndex` state replicate the tester exactly
- `handleNext` advances phase; `handleBack` goes back — same logic as `ScriptTesterDialog`
- Branch probes shown conditionally once a yes/no response is selected (using local `responses` state)
- `currentQ.question` field used (falling back to `currentQ.text`) to match how questions are stored
- `sortedQuestions` sorted by `order` field before display
