
# Add Avg. Call Duration Card to Booking Insights

## Overview

Add an "Avg Duration" card to the Booking Insights summary cards to match the Non-Booking Analysis layout. This requires both database and UI changes since the `member_insights` table doesn't currently store average call duration.

## Current State Comparison

| Card Position | Booking Insights | Non-Booking Analysis |
|---------------|-----------------|---------------------|
| 1 | Calls Analyzed | Non-Booking Calls |
| 2 | Top Pain Point | Transcribed |
| 3 | Overall Sentiment | High Readiness |
| 4 | Top Objection | **Avg Duration** |
| 5 | (none) | (none) |

## Proposed Changes

### Phase 1: Database Update

Add a new column to store average call duration:

```sql
ALTER TABLE member_insights 
ADD COLUMN avg_call_duration_seconds NUMERIC DEFAULT 0;
```

### Phase 2: Edge Function Update

Update `analyze-member-insights` to:
1. Include `call_duration_seconds` in the bookings query
2. Calculate average duration from all analyzed calls
3. Store it in the new column

### Phase 3: UI Update

Update `InsightsSummaryCards.tsx` to:
1. Accept `avg_call_duration_seconds` in the insight prop
2. Add a 5th card with Clock icon showing formatted duration
3. Add the gradient bottom border styling for consistency with Non-Booking cards

## Detailed Implementation

### 1. Database Migration

```sql
ALTER TABLE member_insights 
ADD COLUMN avg_call_duration_seconds NUMERIC DEFAULT 0;
```

### 2. Edge Function Changes (`analyze-member-insights/index.ts`)

Update the bookings query to include duration:
```typescript
const { data: bookingsRaw, error: bookingsError } = await supabase
  .from('bookings')
  .select(`
    id, 
    member_name, 
    market_city, 
    market_state,
    call_duration_seconds,  // <-- ADD THIS
    booking_transcriptions (
      call_key_points
    )
  `)
```

Calculate average in the aggregation loop:
```typescript
let totalDuration = 0;
let durationCount = 0;

for (const booking of bookings) {
  // ... existing logic ...
  
  if (booking.call_duration_seconds && booking.call_duration_seconds > 0) {
    totalDuration += booking.call_duration_seconds;
    durationCount++;
  }
}

const avgCallDuration = durationCount > 0 ? totalDuration / durationCount : 0;
```

Store it when updating the record:
```typescript
.update({
  // ... existing fields ...
  avg_call_duration_seconds: avgCallDuration,
  status: 'completed'
})
```

### 3. Update InsightsSummaryCards.tsx

```text
Summary Cards Layout (Updated)
├── Calls Analyzed (Phone icon, primary color)
├── Top Pain Point (AlertTriangle icon, destructive color)
├── Overall Sentiment (Smile icon, contextual color)
├── Top Objection (TrendingDown icon, amber color)
└── Avg Duration (Clock icon, primary color) <-- NEW
```

Changes:
- Add `avg_call_duration_seconds` to interface
- Add formatDuration helper function
- Add 5th card with Clock icon
- Add gradient bottom borders to all cards for visual consistency
- Update grid to `lg:grid-cols-5` for 5 cards

### 4. Update MemberInsight Interface

In `BookingInsightsTab.tsx`, add to MemberInsight interface:
```typescript
interface MemberInsight {
  // ... existing fields ...
  avg_call_duration_seconds?: number;
}
```

## Visual Consistency Updates

Both tabs will have matching card styling:
- 5 summary cards in a row
- Each with gradient bottom border accent
- Consistent icon/color patterns for similar metrics

## Files to Modify

| File | Changes |
|------|---------|
| Database Migration | Add `avg_call_duration_seconds` column |
| `supabase/functions/analyze-member-insights/index.ts` | Query duration, calculate avg, store it |
| `src/components/member-insights/InsightsSummaryCards.tsx` | Add 5th card, update grid, add gradients |
| `src/components/call-insights/BookingInsightsTab.tsx` | Update MemberInsight interface |

## Technical Notes

- Duration is stored in seconds and formatted as "MM:SS" for display
- Grid changes from 4 to 5 columns on large screens
- Existing insight records will have `avg_call_duration_seconds` default to 0
- New analyses will calculate and populate the field
