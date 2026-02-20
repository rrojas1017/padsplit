
# Scope Cost Alert to Today's Records Only

## What's Changing

The `CostAlertBanner` and its hook `useCostAlertMonitor` currently look back at the last 500 rows across **all time**, then pick the 20 most recent unique bookings. This means the alert can be driven by data from yesterday or last week — it doesn't reflect today's actual pipeline cost health.

The fix scopes the query to records created **since midnight UTC today**, matching exactly what the `get_daily_coaching_gate` DB function already does for the gate logic.

## Changes to `src/hooks/useCostAlertMonitor.ts`

### 1 — Remove the rolling window constant (no longer needed)

The `ROLLING_WINDOW = 20` constant and the `.slice(0, ROLLING_WINDOW)` call are removed. Today's records naturally bound the dataset — there's no need to artificially cap at 20.

### 2 — Add a `todayStart` filter to the Supabase query

```typescript
// Compute start of today in UTC
const todayStart = new Date();
todayStart.setUTCHours(0, 0, 0, 0);

const { data: costs, error } = await supabase
  .from('api_costs')
  .select('booking_id, estimated_cost_usd, created_at')
  .eq('is_internal', false)
  .not('service_type', 'like', 'tts_%')
  .not('booking_id', 'is', null)
  .gte('created_at', todayStart.toISOString())   // ← NEW: today only
  .order('created_at', { ascending: false })
  .limit(500);
```

### 3 — Remove the `.slice(0, ROLLING_WINDOW)` cap

```typescript
// Before
const allRecords = Array.from(bookingMap.entries())
  .slice(0, ROLLING_WINDOW)   // ← remove this
  .map(...)

// After — all of today's unique bookings
const allRecords = Array.from(bookingMap.entries()).map(...)
```

### 4 — Update the banner label in `CostAlertBanner.tsx`

The subtitle currently reads:
> "Rolling Avg Cost Per Record (last {recordCount} records, excl. TTS)"

It will be updated to:
> "Today's Avg Cost Per Record ({recordCount} records today, excl. TTS)"

And the warning/critical messages will say "today's {recordCount} records" instead of "last {recordCount} records".

## Files to Change

| File | Change |
|---|---|
| `src/hooks/useCostAlertMonitor.ts` | Add `gte('created_at', todayStart)` filter; remove `ROLLING_WINDOW` slice; update label string |
| `src/components/billing/CostAlertBanner.tsx` | Update subtitle and alert message copy to say "today" |

## No DB Migration Needed

This is a pure query filter change on the client side. The `api_costs` table already has a `created_at` column with a timestamp — no schema changes required.

## Behaviour When There Are No Records Today

If today has zero records (e.g. before any calls are processed), `recordCount` will be 0, `rollingAvg` will be 0, and the banner will correctly show **HEALTHY** — same as the daily gate logic.
