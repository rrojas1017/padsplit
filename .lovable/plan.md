
# Add 'BadgeSplit' Mishearing Variants to Brand Dictionary

## Overview

Add 2 newly discovered mishearing variants that Deepgram transcribes instead of "PadSplit" to the AI polishing prompt.

---

## Implementation

### File to Modify

`supabase/functions/transcribe-call/index.ts` - Line 193

### Change

**Current (line 193):**
```typescript
- "Plates", "plates", "pads", "Pads", "pads split", "pads lit", "pad slit", "pad split", "pad slip", "padspit", "pad's split", "Pet Sitter", "Petsitter", "pet sitter", "past plate", "path to place", "bath split", "bad supplies", "pathway", "pagespeed", "path split", "Radcliffe" → "PadSplit"
```

**Updated:**
```typescript
- "Plates", "plates", "pads", "Pads", "pads split", "pads lit", "pad slit", "pad split", "pad slip", "padspit", "pad's split", "Pet Sitter", "Petsitter", "pet sitter", "past plate", "path to place", "bath split", "bad supplies", "pathway", "pagespeed", "path split", "Radcliffe", "BadgeSplit", "badgesplit" → "PadSplit"
```

---

## New Variants Being Added

| Mishearing | Reason |
|------------|--------|
| "BadgeSplit" | Found in recent Deepgram transcription logs |
| "badgesplit" | Lowercase variant for consistency |

---

## Summary

| Detail | Value |
|--------|-------|
| File | `supabase/functions/transcribe-call/index.ts` |
| Line | 193 |
| Variants Added | 2 |
| Total PadSplit Variants | 24 |

After this update, the edge function will need to be deployed for the changes to take effect.
