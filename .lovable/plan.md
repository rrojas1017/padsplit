

# Fix Contact Profile Hover Card - Array vs Object Access

## Root Cause

The **Contact Profile Hover Card** appears empty because of a data access mismatch:

| Expected | Actual | Result |
|----------|--------|--------|
| `booking_transcriptions` as array `[{...}]` | `booking_transcriptions` as object `{...}` | Code accesses `[0]` which returns `undefined` |

The Supabase embedded select returns a **single object** for one-to-one relationships, not an array. The current code incorrectly uses array indexing:

```typescript
// Current (BROKEN) - line 281 of useReportsData.ts
const transcription = (row.booking_transcriptions as any)?.[0];  // Returns undefined!

// API actually returns:
"booking_transcriptions": { "call_summary": "...", "call_key_points": {...} }
```

## The Fix

Change the data access from array notation to direct object access:

```typescript
// Fixed
const transcription = row.booking_transcriptions as any;  // Direct object access
```

## File to Modify

| File | Change |
|------|--------|
| `src/hooks/useReportsData.ts` | Line 281: Remove `?.[0]` array indexing |

## Technical Change

```text
BEFORE (line 281):
const transcription = (row.booking_transcriptions as any)?.[0];

AFTER:
const transcription = row.booking_transcriptions as any;
```

## Verification

After this fix:
1. Hover over any contact with `transcription_status: completed`
2. The hover card will display:
   - Move-In Readiness badge (HIGH/MEDIUM/LOW)
   - Sentiment indicator (positive/neutral/negative)
   - Budget, household size, commitment
   - Member preferences (top 3)
   - Concerns raised (top 3)
   - Objections (if any)

## Why This Happened

Supabase's PostgREST returns embedded foreign key relationships differently based on cardinality:
- **One-to-many**: Returns an array `[{...}, {...}]`
- **One-to-one**: Returns a single object `{...}`

Since each booking has exactly one transcription record, Supabase returns an object, not an array.

