
# Add a Call Timer to the Research Script Wizard

## What the User Wants

A live elapsed-time clock visible while the researcher is on a script call, with a 10-minute target. The agent can see how long they've been on the call at a glance.

## Where It Lives

The clock should appear **next to the StepTracker bar** — the thin progress bar already shown at the top of the active wizard. This is the most natural place: the researcher can glance up to see both their position in the script and how long the call has been running.

The clock needs to be added in two places:
1. **`LogSurveyCall.tsx`** — the real call logging wizard (primary)
2. **`ScriptTesterDialog.tsx`** — the test mode dialog (for consistency)

## Timer Behavior

- **Starts** the moment the script phase begins (when the researcher clicks "Start Script" and transitions from `setup` → `verify`)
- **Counts up** — shows elapsed time as `M:SS` format (e.g. `3:45`)
- **Color changes** based on progress toward the 10-minute target:
  - **Green** `0:00 – 8:59` — on track
  - **Amber** `9:00 – 10:59` — approaching target
  - **Red** `11:00+` — over target
- **Target label** shows `/ 10:00` next to the elapsed time so the agent always knows the goal
- **Resets** when the form is reset (new call)
- **Stops** on the wrapup/done phase (call is over) but keeps showing the final time so the researcher knows how long it took

## Visual Design

The timer sits to the right of the step tracker, before the "End Call" button. It's a small compact chip:

```
[ Verify ] ——— [ Consent ] ——— [ Q 3/8 ] ——— [ Closing ]    ⏱ 3:45 / 10:00    [End Call]
```

The timer chip is small (`text-xs`) with a clock icon and colour-coded text, consistent with the rest of the tracker bar's design language.

## Implementation Details

### Timer Logic in `LogSurveyCall.tsx`

- Add a `callStartTime` state (`Date | null`) — set to `new Date()` when `handleStartScript()` is called
- Add a `elapsedSeconds` state updated every second via `setInterval`, but only when the phase is active (not `setup` or `wrapup`)
- Reset `callStartTime` to `null` in `resetForm()`

```typescript
const [callStartTime, setCallStartTime] = useState<Date | null>(null);
const [elapsedSeconds, setElapsedSeconds] = useState(0);

// In handleStartScript():
setCallStartTime(new Date());
setElapsedSeconds(0);

// In resetForm():
setCallStartTime(null);
setElapsedSeconds(0);
```

The interval runs while `callStartTime` is set and phase is not `wrapup`:
```typescript
useEffect(() => {
  if (!callStartTime || phase === 'wrapup' || phase === 'setup') return;
  const interval = setInterval(() => {
    setElapsedSeconds(Math.floor((Date.now() - callStartTime.getTime()) / 1000));
  }, 1000);
  return () => clearInterval(interval);
}, [callStartTime, phase]);
```

### Timer Display Component

A small inline helper that formats seconds and applies colour:

```typescript
function CallTimer({ elapsedSeconds }: { elapsedSeconds: number }) {
  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;
  const display = `${mins}:${String(secs).padStart(2, '0')}`;
  const TARGET = 600; // 10 min in seconds
  
  const color =
    elapsedSeconds >= 660   ? 'text-red-600'    // 11+ min
    : elapsedSeconds >= 540 ? 'text-amber-600'  // 9–11 min
    : 'text-green-600';                         // < 9 min
  
  return (
    <div className={`flex items-center gap-1 text-xs font-mono font-semibold ${color} shrink-0`}>
      <Clock className="w-3 h-3" />
      <span>{display}</span>
      <span className="text-muted-foreground font-normal">/ 10:00</span>
    </div>
  );
}
```

### Passing the Timer into StepTracker

Rather than restructuring the `StepTracker` component (which is already complex with cluster mode), the timer is rendered **alongside** the `StepTracker` in the parent component, wrapped in a flex container. This keeps `StepTracker` clean.

In `LogSurveyCall.tsx`, the StepTracker block changes from:
```tsx
<div className="max-w-2xl mx-auto">
  <StepTracker ... />
</div>
```

To:
```tsx
<div className="max-w-2xl mx-auto">
  <div className="flex items-center gap-3">
    <div className="flex-1">
      <StepTracker ... />
    </div>
    {callStartTime && (
      <CallTimer elapsedSeconds={elapsedSeconds} />
    )}
  </div>
</div>
```

### ScriptTesterDialog

Same pattern — `callStartTime` is set when the phase moves past `start`, and reset when `restart()` is called. Since the tester dialog already has its own StepTracker block, the same wrapper approach applies.

## Files to Change

| File | Change |
|---|---|
| `src/pages/research/LogSurveyCall.tsx` | Add `callStartTime` + `elapsedSeconds` state, set on `handleStartScript`, reset in `resetForm`, add interval effect, add `CallTimer` component, wrap StepTracker in flex row with timer |
| `src/components/research/ScriptTesterDialog.tsx` | Same — add timer state, set on phase transition from `start`, reset in `restart()`, wrap StepTracker with `CallTimer` |

No changes needed to `StepTracker.tsx` — the timer sits beside it, not inside it.
