

# Add Contact Profile Hover Card in Reports

## Overview

Add a hover popup on the **Contact Name** column in the Reports table that displays AI-generated insights about each contact's preferences, concerns, and profile. This applies to **ALL record types** (bookings, non-bookings, and any future types) that have been processed through the transcription pipeline.

## Universal Support

| Record Type | Hover Card Behavior |
|-------------|---------------------|
| Booking (with transcription) | Full insights from `call_key_points` |
| Non-Booking (with transcription) | Full insights from `call_key_points` |
| Manual entry (no call) | "No call insights available" |
| Imported record (no transcription) | "No call insights available" |
| Future record types | Automatic - uses same data structure |

## What Users Will See

```text
Hover over any contact name in Reports:

┌────────────────────────────────────┐
│ 👤 Jason Sorensen                  │
│ ─────────────────────────────────  │
│ 🎯 Move-In Ready: HIGH   😊 Positive│
│ ─────────────────────────────────  │
│ 💵 Budget: $149/week               │
│ 👥 Household: 1 person             │
│ 📅 Commitment: 6 months            │
│ ─────────────────────────────────  │
│ 📋 What They Want:                 │
│ • Room without moving fee          │
│ • Move in today                    │
│ • Near public transit              │
│ ─────────────────────────────────  │
│ ⚠️ Concerns Raised:                │
│ • Payment timing confusion         │
│ • Worried about roommates          │
│ ─────────────────────────────────  │
│ 💡 Click name for full transcript  │
└────────────────────────────────────┘
```

## Data Source

All data comes from the existing `call_key_points` field (already fetched in Reports):

| Display Section | Source Field |
|-----------------|--------------|
| Readiness badge | `callKeyPoints.moveInReadiness` |
| Sentiment icon | `callKeyPoints.callSentiment` |
| Budget | `callKeyPoints.memberDetails.weeklyBudget` |
| Household size | `callKeyPoints.memberDetails.householdSize` |
| Commitment | `callKeyPoints.memberDetails.commitmentWeeks` |
| Preferences | `callKeyPoints.memberPreferences[]` |
| Concerns | `callKeyPoints.memberConcerns[]` |
| Objections | `callKeyPoints.objections[]` |

## Files to Create/Modify

| File | Changes |
|------|---------|
| **New:** `src/components/reports/ContactProfileHoverCard.tsx` | Hover card component with profile sections |
| `src/pages/Reports.tsx` | Wrap contact name in HoverCard trigger |

## Component Structure

### ContactProfileHoverCard Props

```typescript
interface ContactProfileHoverCardProps {
  memberName: string;
  callKeyPoints?: CallKeyPoints;
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'unavailable';
  children: React.ReactNode; // The trigger element (contact name)
}
```

### Visual Indicators

| Indicator | Values | Colors |
|-----------|--------|--------|
| Move-In Readiness | High / Medium / Low | Green / Yellow / Red |
| Sentiment | Positive / Neutral / Negative | Green / Gray / Red |
| Transcription Status | Completed / Processing / None | Show / Loading / "No insights" |

### Empty States

```text
No transcription:           Processing:
┌──────────────────────┐   ┌──────────────────────┐
│ 👤 John Smith        │   │ 👤 Jane Doe          │
│ ────────────────────│   │ ────────────────────│
│ 📭 No call insights  │   │ ⏳ Insights being    │
│    available         │   │    generated...      │
│                      │   │                      │
│ Manual entry or      │   │ Check back shortly   │
│ import without call  │   │                      │
└──────────────────────┘   └──────────────────────┘
```

## Technical Details

- Uses existing `@radix-ui/react-hover-card` (already installed)
- No additional database queries - data already in Reports response
- Works with existing `Booking` type and `CallKeyPoints` interface
- Reuses badge/icon patterns from existing components
- HoverCard with 200ms open delay to prevent accidental triggers
- Max width: 320px for comfortable reading

## Future-Proofing

The implementation automatically supports future record types because:
1. All records use the same `bookings` table
2. All records that go through transcription get `call_key_points`
3. The hover card checks for data presence, not record type
4. Empty state handles any record without transcription data

