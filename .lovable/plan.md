
# Fix Contact Profile Hover Card - Data Fetching

## The Issue

The **Contact Profile Hover Card** appears empty because the `call_key_points` data is stored in a separate table (`booking_transcriptions`) rather than directly in the `bookings` table. The Reports page query only reads from `bookings`, so the data is always `undefined`.

## Data Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Current Flow (BROKEN)                                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   useReportsData                                                    │
│        │                                                            │
│        ▼                                                            │
│   SELECT call_key_points FROM bookings   →   NULL (always)         │
│        │                                                            │
│        ▼                                                            │
│   ContactProfileHoverCard receives undefined  →  Shows empty       │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Actual Data Location                                                │
│                                                                     │
│   booking_transcriptions                                            │
│   ├── booking_id (FK to bookings.id)                               │
│   ├── call_key_points  ✅ (has the data!)                          │
│   ├── call_summary                                                  │
│   ├── call_transcription                                            │
│   └── agent_feedback                                               │
└─────────────────────────────────────────────────────────────────────┘
```

## Solution

Update `useReportsData` to JOIN with `booking_transcriptions` table and retrieve the heavy call data from there. Supabase supports this via the embedded select syntax.

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useReportsData.ts` | Add LEFT JOIN to `booking_transcriptions` and map data correctly |

## Technical Changes

### useReportsData.ts

**Change the query to include the related transcription data:**

```typescript
// Current (broken)
.select(`
  id,
  call_key_points,  // Always NULL in bookings table
  ...
`)

// Fixed
.select(`
  id,
  ...,
  booking_transcriptions (
    call_transcription,
    call_summary,
    call_key_points,
    agent_feedback
  )
`)
```

**Update the transformation to use joined data:**

```typescript
// Map the joined data correctly
const transcription = row.booking_transcriptions?.[0];
return {
  ...
  callKeyPoints: transcription?.call_key_points || undefined,
  callSummary: transcription?.call_summary || undefined,
  callTranscription: transcription?.call_transcription || undefined,
  agentFeedback: transcription?.agent_feedback || undefined,
};
```

## Expected Result

After this fix:
1. Hover over any contact with a completed transcription
2. The hover card will display rich insights (preferences, concerns, readiness, sentiment)
3. Records without transcriptions will show the "No call insights available" empty state

## Why This Approach?

- Uses Supabase's built-in foreign key relationships (no extra queries)
- Single efficient query with LEFT JOIN
- Maintains backward compatibility
- No database schema changes needed
