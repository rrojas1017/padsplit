
## Expand Script Wizard Layout — Both External & Internal Views

### Problem
Both the external public view (`PublicScriptView.tsx`) and internal tester dialog (`ScriptTesterDialog.tsx`) waste significant screen real estate. The external page caps its content at `max-w-lg` (512px) centered on screen, while the internal dialog is locked to `sm:max-w-lg` with `max-h-[85vh]` — both forcing agents to read compressed, small-font content.

---

### Changes

#### 1. External View — `src/pages/PublicScriptView.tsx`

**Current issues:**
- `max-w-lg` (512px) wizard container — tiny on desktop
- `max-w-2xl` header — mismatched with body width
- `p-6` card padding with `space-y-5` — comfortable but text area is cramped
- Script block text is `text-base` / `text-lg` — readable but the container squishes it

**Changes:**
- Expand wizard container from `max-w-lg` → `max-w-3xl` (768px) — uses available horizontal space
- Match header `max-w-2xl` → `max-w-3xl` for alignment
- Increase `WizardCard` padding from `p-6` → `p-8` and `space-y-5` → `space-y-6`
- Upgrade `ScriptBlock` text from `text-base` → `text-lg` and `p-5` → `p-6` for better readability
- Increase question text in the `bg-muted` block from `text-lg` → `text-xl`, padding `p-5` → `p-6 py-7`
- Scale Yes/No consent buttons larger: `px-10 py-6 text-xl`
- Give the `open_ended` Textarea `rows={4}` (was 3)
- Add `min-h-screen` body layout so the page always fills vertically

#### 2. Internal Dialog — `src/components/research/ScriptTesterDialog.tsx`

**Current issues:**
- Dialog capped at `sm:max-w-lg` (512px) — far too narrow
- `max-h-[85vh]` forces scrolling inside a small box
- Question text, radio items and script blocks have minimal padding

**Changes:**
- Expand dialog from `sm:max-w-lg` → `sm:max-w-3xl` (768px)
- Change `max-h-[85vh]` → `max-h-[90vh]` to use more vertical height
- Increase script text containers from `p-5` → `p-6`
- Upgrade `text-xl` question text to `text-2xl` for easier reading during live calls
- Make radio group items (yes_no / multiple_choice) match the external view: border-boxed items with `px-4 py-3` instead of bare `flex items-center gap-2`
- Expand Yes/No consent buttons to `px-10 py-6 text-xl`
- Give `open_ended` Textarea `rows={4}` (was 3)
- Add probing follow-ups section with proper box style (matching external view) — currently the internal tester doesn't show probes

---

### Visual Result

```text
BEFORE (external)                 AFTER (external)
┌──────────────────────────────┐  ┌────────────────────────────────────────────────────────┐
│     [narrow 512px card]      │  │           [wide 768px card — fills screen]             │
│  Q: Did you feel supported?  │  │  Q: Did you feel supported in your PadSplit stay?       │
│  ○ Yes                       │  │                                                         │
│  ○ No                        │  │  ┌─────────────────────────────┐                        │
└──────────────────────────────┘  │  │ ○  Yes                      │                        │
                                  │  │ ○  No                       │                        │
                                  │  └─────────────────────────────┘                        │
                                  └────────────────────────────────────────────────────────┘
```

---

### Files Changed

| File | Change |
|---|---|
| `src/pages/PublicScriptView.tsx` | Widen card container, larger text, bigger padding |
| `src/components/research/ScriptTesterDialog.tsx` | Widen dialog, bigger text, boxed radio items, add probes |

No logic changes — UI layout and sizing only. No backend changes needed.
