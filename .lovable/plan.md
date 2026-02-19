
# Script Progression Graph — Visual Step Tracker

## Goal
Replace the plain percentage progress bar with a visually rich, modern **step-by-step progression track** that shows the agent exactly where they are in the call flow at a glance — without adding noise to the interface.

## Design Concept

A horizontal "pill track" of named steps, connected by a thin line, with three visual states:

- **Completed** — filled circle with a checkmark, muted color
- **Active** — glowing ring (pulse ring animation), primary color, label bold
- **Upcoming** — empty outlined circle, muted/faded

```text
  ✓ Intro  ──  ✓ Consent  ──  ● Q 2/5  ──  ○ Closing
              [filled]          [active]      [empty]
```

The track is compact — circles are small (20–24px), labels are 10–11px, and the whole component sits between the dialog header and the content area without taking up much vertical space. On mobile/small dialogs it gracefully truncates labels.

## Step Nodes Generated Dynamically

Steps are derived from the script structure:
1. **Intro** — shown only if `intro_script` exists
2. **Consent** — always shown
3. **Q 1, Q 2 … Q n** — one dot per question (dots, no label if more than 5 questions — just a cluster with the active one labeled)
4. **Closing** — shown only if `closing_script` exists

> For scripts with many questions (>5), the question dots compress into a mini cluster — showing only the active dot enlarged, flanked by neighbor dots, to prevent overflow.

## Visual Details

- Step circles: `w-5 h-5` with `ring-2 ring-offset-2` on active
- Connecting line: `h-px bg-border flex-1` between circles — turns `bg-primary/40` for completed segments
- Active node: subtle `animate-pulse` shadow ring in primary color
- Completed nodes: checkmark icon inside, `bg-primary text-primary-foreground`
- Upcoming nodes: `border-2 border-muted-foreground/30 bg-background`
- The "End Call" button is relocated to the right side of this tracker row, keeping it in the same visual band

## Files to Modify

### `src/components/research/ScriptTesterDialog.tsx`
- Replace the current `<Progress>` bar + label row with a new inline `StepTracker` sub-component
- StepTracker builds an array of step objects (label, state: `complete | active | upcoming`) based on `phase` and `questionIndex`
- Question steps: if ≤ 5 questions, show all individually; if > 5, show a compressed dot cluster
- End Call button stays in this same row, floated right

### `src/pages/research/LogSurveyCall.tsx`
- Same StepTracker component pattern applied to the wizard header area, replacing/augmenting the existing `<Progress>` bar in the active phases
- Since LogSurveyCall has a `setup` phase too, the tracker only appears from `intro` phase onward

## Technical Details

The step array builder logic (pseudo):

```typescript
const steps = [];
if (introScript) steps.push({ id: 'intro', label: 'Intro' });
steps.push({ id: 'consent', label: 'Consent' });
questions.forEach((_, i) => steps.push({ id: `q-${i}`, label: `Q${i + 1}` }));
if (closingScript) steps.push({ id: 'closing', label: 'Closing' });

// Determine activeIndex based on phase + questionIndex
```

State assignment per node:
- index < activeIndex → `complete`
- index === activeIndex → `active`
- index > activeIndex → `upcoming`

The component is self-contained — no new dependencies. Uses only existing Tailwind classes and `lucide-react` (`Check` icon for completed steps).

## What Does NOT Change
- All existing logic (branching, yes/no enforcement, End Call disposition)
- Question content rendering
- Navigation buttons
- Submission flow in LogSurveyCall

The visual tracker is purely additive and replaces only the `<Progress>` bar section.
