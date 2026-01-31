
# Add "Pet Sitter" Mishearing Variant to Polishing Prompt

## Overview

Add "Pet Sitter" and "Petsitter" as additional mishearing variants that Deepgram sometimes transcribes instead of "PadSplit".

---

## Implementation

### File to Modify

`supabase/functions/transcribe-call/index.ts` - Line 193

### Change

**Current (line 193):**
```typescript
- "Plates", "plates", "pads", "Pads", "pads split", "pads lit", "pad slit", "pad split", "pad slip", "padspit", "pad's split" → "PadSplit"
```

**Updated:**
```typescript
- "Plates", "plates", "pads", "Pads", "pads split", "pads lit", "pad slit", "pad split", "pad slip", "padspit", "pad's split", "Pet Sitter", "Petsitter", "pet sitter" → "PadSplit"
```

---

## Summary

| Change | Details |
|--------|---------|
| File | `supabase/functions/transcribe-call/index.ts` |
| Line | 193 |
| Variants Added | "Pet Sitter", "Petsitter", "pet sitter" |

This ensures all case variations of the "Pet Sitter" mishearing are corrected to "PadSplit".
