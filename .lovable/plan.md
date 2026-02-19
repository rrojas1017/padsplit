
# Auto-Format Names & Phone Number in Setup

## What This Does

Two smart auto-formatting behaviors are added to the **Setup** phase inputs in both `LogSurveyCall.tsx` and `ScriptTesterDialog.tsx`:

### 1. Name Auto-Capitalization
As the agent types each word in the First Name and Last Name fields, the first letter of every word is automatically capitalized on the fly. No manual correction needed.

- `ramon` → `Ramon`
- `de la cruz` → `De La Cruz`
- `jean-pierre` → stays as typed (hyphens preserved; only first letter of first word is forced cap)

### 2. Phone Number Auto-Formatting
As the agent types the phone number, digits are extracted and formatted live into: `+1 XXX-XXX-XXXX`

- User types: `3054332275` → displayed as: `+1 305-433-2275`
- User types: `(305) 433-2275` → cleaned and displayed as: `+1 305-433-2275`
- User types: `13054332275` (with leading 1) → still: `+1 305-433-2275`
- The raw input is replaced immediately so the field always shows the formatted version

---

## Implementation Strategy

Two small utility functions added directly in each file (no new files needed):

```typescript
// Auto-capitalize: every word's first letter uppercased
function autoCapitalizeName(value: string): string {
  return value
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Phone formatter: extract digits, strip leading 1, format as +1 XXX-XXX-XXXX
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  // Strip leading country code 1 if present and digits > 10
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (local.length === 0) return '';
  if (local.length <= 3) return `+1 ${local}`;
  if (local.length <= 6) return `+1 ${local.slice(0, 3)}-${local.slice(3)}`;
  return `+1 ${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6, 10)}`;
}
```

These run inside the `onChange` handlers — no `onBlur` needed, it reformats as the user types.

---

## Files to Modify

### 1. `src/pages/research/LogSurveyCall.tsx`

**First Name field** (line ~524):
```tsx
// Before
onChange={e => setCallerFirstName(e.target.value)}

// After
onChange={e => setCallerFirstName(autoCapitalizeName(e.target.value))}
```

**Last Name field** (line ~536):
```tsx
onChange={e => setCallerLastName(autoCapitalizeName(e.target.value))}
```

**Phone Number field** (line ~551):
```tsx
onChange={e => setCallerPhone(formatPhone(e.target.value))}
placeholder="+1 305-433-2275"
```

Also update the **Verify phase** corrected name fields (lines ~641, ~650) to use `autoCapitalizeName` too, since agents can correct names there as well.

**Verify phase callback number field** (line ~663):
```tsx
onChange={e => setVerifiedPhone(formatPhone(e.target.value))}
```

### 2. `src/components/research/ScriptTesterDialog.tsx`

**Tester First Name field** (verify phase):
```tsx
onChange={e => setTesterFirstName(autoCapitalizeName(e.target.value))}
```

**Tester Last Name field**:
```tsx
onChange={e => setTesterLastName(autoCapitalizeName(e.target.value))}
```

**Tester Phone field**:
```tsx
onChange={e => setTesterPhone(formatPhone(e.target.value))}
```

---

## What Does NOT Change
- All validation logic (`validateSetup`) — the formatted phone value is what gets stored and validated
- Submission payload — already stores `verifiedPhone`, which will now be pre-formatted
- No new dependencies, no new files
- All branching, question flow, and step tracker logic untouched
