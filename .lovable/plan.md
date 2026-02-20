
# Fix: Exclude Research Calls from the Daily Cost Gate

## The Problem

The `get_daily_coaching_gate()` database function calculates today's average cost per record to decide whether to block voice coaching generation. Currently it looks at **all** `api_costs` rows linked to any `booking_id`, including research calls.

Research calls:
- Are often very long (20+ min survey calls)
- Generate significant STT costs (e.g. a 25-min call = ~$0.107 in STT alone at Deepgram rates, or ~$0.85 with ElevenLabs)
- **Never** have voice coaching generated — it is not a feature for research records at all

This means a single long research call today could push the daily average above $0.07 and wrongly block voice coaching for the entire sales team — even though research calls have nothing to do with the coaching pipeline.

## The Fix

A single migration that updates `get_daily_coaching_gate()` to join `api_costs` against `bookings` and filter out any row where `record_type = 'research'`.

The SQL change is minimal — add one JOIN and one WHERE clause:

```sql
FROM api_costs c
JOIN bookings b ON b.id = c.booking_id   -- NEW
WHERE c.is_internal = false
  AND c.service_type NOT LIKE 'tts_%'
  AND c.booking_id IS NOT NULL
  AND c.created_at >= v_today_start
  AND b.record_type != 'research'         -- NEW: exclude research records
```

No frontend changes are needed — the hook (`useDailyCostGate`) and all the player components already consume the RPC correctly. The fix is entirely in the DB function.

## Why Only a Migration?

The `get_daily_coaching_gate()` function uses `SECURITY DEFINER`, meaning it runs with elevated privileges internally. The `bookings` table is readable at this level, so the join is safe. No RLS changes are needed.

## Files to Change

| File | Change |
|---|---|
| New migration | `CREATE OR REPLACE FUNCTION public.get_daily_coaching_gate()` — add `JOIN bookings b ON b.id = c.booking_id` and `AND b.record_type != 'research'` to the WHERE clause |

That's it. One migration, no frontend changes required.
