

# Fix Contact Profile Hover Card - Improve Readability

## Problem

The bullet points in the hover card are truncated and unreadable because:

| Issue | Example |
|-------|---------|
| **Verbose prefixes** | "Initial location interest: A property in 'Toronto'..." |
| **Single-line truncation** | Only shows "Initial location interest: A proper..." before cutting off |
| **Lost context** | The actual useful information (the preference/concern) is hidden |

Screenshot shows text like:
- "Initial location interest: A property in 'Toronto'..."
- "Final location choice: A property "close to..."
- "Asked about the required commitment length..."

## Solution

Two-part fix to make the content scannable and useful:

### 1. Frontend: Improve Text Display

**Remove `line-clamp-1`** - Allow text to wrap to 2 lines for better readability:

```text
BEFORE: line-clamp-1 (cuts after ~30 chars)
• Initial location interest: A proper...

AFTER: line-clamp-2 (allows 2 lines, ~80 chars visible)
• Initial location interest: A property
  in 'Toronto' near downtown
```

**Also improve the layout:**
- Use `line-clamp-2` for preferences (more context)
- Use `line-clamp-2` for concerns (these are critical to address)
- Reduce items shown from 3/2 to 2/2 to save space while showing more per item

### 2. Backend: Cleaner AI Extraction (Optional Future Improvement)

Update the AI prompt to generate concise bullet points without verbose prefixes:

```text
BEFORE (AI generates):
"Initial location interest: A property in 'Toronto' near downtown"

AFTER (AI should generate):
"Property near downtown Toronto"
```

This is a future enhancement - the frontend fix will provide immediate improvement.

---

## File Changes

| File | Change |
|------|--------|
| `src/components/reports/ContactProfileHoverCard.tsx` | Replace `line-clamp-1` with `line-clamp-2`, adjust item counts |

---

## Implementation Details

### ContactProfileHoverCard.tsx Changes

**Looking For section (lines 221-229):**
- Change `line-clamp-1` to `line-clamp-2`
- Keep showing 3 items (but each can now wrap to 2 lines)

**Concerns section (lines 241-249):**
- Change `line-clamp-1` to `line-clamp-2`
- Keep showing 2 items (each can wrap to 2 lines)

### Code Changes

```typescript
// Line 225: Preferences
// FROM:
<span className="line-clamp-1">{pref}</span>

// TO:
<span className="line-clamp-2 leading-snug">{pref}</span>


// Line 245: Concerns
// FROM:
<span className="line-clamp-1">{concern}</span>

// TO:
<span className="line-clamp-2 leading-snug">{concern}</span>
```

---

## Visual Result

```text
┌─────────────────────────────────────────────────────────────┐
│ 👤 Khafre Budram                               🎯 HIGH       │
│ ────────────────────────────────────────────────────────────│
│                                                             │
│ 💰 BUDGET & TIMELINE                                        │
│ $620/wk  ·  Move: February 2nd  ·  3 months                │
│                                                             │
│ ✨ LOOKING FOR                                              │
│ • Initial location interest: A property in                 │
│   'Toronto' near downtown                                   │
│ • Final location choice: A property "close to              │
│   public transit" with parking                             │
│ • Room preference: Chose the "yellow room"                 │
│   for natural light                                        │
│                                                             │
│ ⚠️ CONCERNS                                                 │
│ • Asked about the required commitment length               │
│   and early termination options                            │
│ • Questioned the timing of a potential payment             │
│   schedule change                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Why This Works

| Approach | Benefit |
|----------|---------|
| `line-clamp-2` | Shows ~2x more text per item |
| `leading-snug` | Tighter line height for compact display |
| Keep item counts | Balance between info density and space |
| Hover card remains usable | Not too tall, still quick to scan |

---

## Summary

This is a focused UI fix that doubles the visible text per bullet point. The hover card will now display enough context to understand each preference and concern without needing to click through to full insights.

