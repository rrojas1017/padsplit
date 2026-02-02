
# Increase BookingsContext Record Limit

## Problem Summary

The current `BookingsContext` fetches only **500 records** (line 67), which causes data truncation on the Dashboard when there are more than 500 bookings in the selected time period. This results in:

- **PadSplit showing 186** instead of the actual **375** bookings
- **Vixicom showing 314** instead of the actual **568** bookings
- Some agents appearing to have zero bookings when they actually have activity

## Solution

Increase the record limit from **500 to 2000** in `BookingsContext.tsx`. This is a safe increase because:

1. The query already filters to **last 90 days** (line 44-47), which bounds the data
2. The query only selects **lightweight columns** (no transcriptions, no heavy text fields)
3. The 90-day window combined with 2000 records supports approximately **22 bookings/day** average, which covers expected growth

---

## Technical Changes

| File | Change |
|------|--------|
| `src/contexts/BookingsContext.tsx` | Change `.limit(500)` to `.limit(2000)` on line 67 |

---

## Code Change

**Before (line 67):**
```typescript
.limit(500);
```

**After:**
```typescript
.limit(2000);
```

---

## Impact Analysis

| Metric | Before | After |
|--------|--------|-------|
| Records loaded | 500 | 2000 |
| PadSplit bookings (30 days) | 186 (truncated) | 375 (complete) |
| Vixicom bookings (30 days) | 314 (truncated) | 568 (complete) |
| Estimated payload size | ~75 KB | ~300 KB |
| Load time impact | Baseline | +100-200ms |

---

## Safety Considerations

This change respects the existing architectural constraints:

1. **Date limit preserved**: 90-day window remains in place
2. **Lightweight columns only**: No heavy text/JSON fields in this query
3. **Circuit breaker protection**: `deduplicatedQuery` wrapper still active
4. **Rate limiting**: 5-second minimum between fetches still enforced
5. **Debounced realtime**: 2-second debounce on subscription updates

---

## Expected Results

After this fix:

1. Dashboard KPI cards will show accurate totals for all sites
2. All active agents will appear on the Leaderboard when they have bookings
3. Chart data will reflect complete booking counts by day
4. Market distribution pie chart will show accurate percentages
