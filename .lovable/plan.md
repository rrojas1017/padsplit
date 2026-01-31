

# Add New PadSplit Mishearing Variants to AI Polishing Prompt

## Overview

Add 8 newly discovered mishearing variants that Deepgram transcribes instead of "PadSplit" to ensure consistent brand name correction across all transcripts.

---

## Implementation

### File to Modify

`supabase/functions/transcribe-call/index.ts` - Line 193

### Change

**Current (line 193):**
```typescript
- "Plates", "plates", "pads", "Pads", "pads split", "pads lit", "pad slit", "pad split", "pad slip", "padspit", "pad's split", "Pet Sitter", "Petsitter", "pet sitter" → "PadSplit"
```

**Updated:**
```typescript
- "Plates", "plates", "pads", "Pads", "pads split", "pads lit", "pad slit", "pad split", "pad slip", "padspit", "pad's split", "Pet Sitter", "Petsitter", "pet sitter", "past plate", "path to place", "bath split", "bad supplies", "pathway", "pagespeed", "path split", "Radcliffe" → "PadSplit"
```

---

## New Variants Being Added

| Mishearing | Source Pattern |
|------------|----------------|
| "past plate" | Phonetic similarity |
| "path to place" | Multi-word misinterpretation |
| "bath split" | Similar consonants |
| "bad supplies" | Phonetic confusion |
| "pathway" | Truncated version |
| "pagespeed" | Technical term confusion |
| "path split" | Close pronunciation |
| "Radcliffe" | Proper noun substitution |

---

## Summary

| Detail | Value |
|--------|-------|
| File | `supabase/functions/transcribe-call/index.ts` |
| Line | 193 |
| Variants Added | 8 |
| Total PadSplit Variants | 21 |

This update expands the brand correction dictionary to handle the most common Deepgram mishearings discovered in recent transcription analysis.

