
# Fix: Dialog Closes & Resets on Outside Click

## Root Cause

In `ScriptTesterDialog.tsx`, line 128:

```tsx
<Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) restart(); }}>
```

And line 129 — the `DialogContent` has no protection against outside clicks. By default, Radix UI Dialog closes (and fires `onOpenChange(false)`) when the user clicks outside it. This triggers `restart()`, wiping all progress.

## Fix — Two Changes in One File

### `src/components/research/ScriptTesterDialog.tsx`

**Change 1: Block outside-click dismissal**

Add `onInteractOutside` and `onEscapeKeyDown` interceptors to `DialogContent` so neither an accidental click outside nor pressing Escape can close the dialog mid-test:

```tsx
<DialogContent
  className="sm:max-w-3xl max-h-[90vh] overflow-y-auto"
  onInteractOutside={(e) => e.preventDefault()}
  onEscapeKeyDown={(e) => e.preventDefault()}
>
```

This is the standard Radix UI pattern for "sticky" dialogs that must not be accidentally dismissed.

**Change 2: Clean up the `onOpenChange` handler**

Remove the auto-`restart()` call from the `onOpenChange` callback. State should only reset when the user explicitly clicks "Restart Test" or "Close":

```tsx
// Before
<Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) restart(); }}>

// After  
<Dialog open={open} onOpenChange={onOpenChange}>
```

The `restart()` call stays on the "Restart Test" button (already correct). The "Close" button already calls `onOpenChange(false)` directly — we'll also chain `restart()` there so the dialog resets cleanly for next time it's opened:

```tsx
<Button variant="outline" onClick={() => { onOpenChange(false); restart(); }}>Close</Button>
```

## What Changes
- Clicking outside the dialog → nothing happens, test continues uninterrupted
- Pressing Escape → nothing happens
- Clicking "Close" on the done screen → dialog closes and state resets for next open
- Clicking "Restart Test" → state resets and stays on the start screen (existing behavior, unchanged)
- The X button in the top-right corner of the dialog will also be blocked from closing mid-test

## No Other Files Need Changes

This is isolated entirely to `ScriptTesterDialog.tsx`. The `LogSurveyCall.tsx` wizard is a full page (not a dialog), so it is not affected by this issue.
