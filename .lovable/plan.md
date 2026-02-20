
# Disable Voice Coaching Generation When Daily Avg Cost Exceeds $0.07

## What Needs to Change

The user wants voice coaching audio generation to be **automatically blocked** whenever the current day's average cost per record exceeds $0.07. This is distinct from the existing rolling-window alert (last 20 records) — this is a **per-day gate** that directly disables the "Generate" button on both the Jeff coaching player and the Katty QA coaching player.

The real data confirms this is relevant. Looking at actual daily averages from the database:

| Date | Avg Cost/Record | Status |
|---|---|---|
| Feb 20 (today, post-fix) | $0.054 | Healthy |
| Feb 19 | $0.100 | Over threshold |
| Feb 18 | $0.114 | Over threshold |
| Feb 17 | $0.074 | Over threshold |
| Feb 16 | $0.071 | Over threshold |
| Feb 13 | $0.097 | Over threshold |

Most days have been over $0.07. If those days had this gate in place, new TTS audio generation requests would have been blocked, protecting the margin.

## Architecture Decision: Where Does the Check Live?

There are two options:

**Option A — Client-side only:** The UI hook calculates today's daily avg and passes a `coachingBlocked` flag down to both player components. Generation buttons are disabled with a tooltip explaining why.

**Option B — Backend guard + client disable:** The edge function `generate-coaching-audio` and `generate-qa-coaching-audio` also check and reject the request server-side, and the UI mirrors this.

The plan uses **Option A as the primary UX gate** (instant feedback to user, no wasted network call) with a **note on adding backend enforcement** as a follow-up. The backend functions already exclude TTS costs from the rolling average, so TTS generation being blocked is the correct behaviour — TTS is the expensive on-demand action.

## New Exported Value from `useCostAlertMonitor`

The hook already calculates a rolling average. We need to add a parallel **daily average** calculation: today's cost rows grouped to get today's avg per record. This is a separate query scoped to today only.

The hook will export two new fields:
- `todayAvg: number` — today's avg cost per record (excl. TTS)
- `todayRecordCount: number` — number of unique bookings processed today
- `coachingBlocked: boolean` — `true` when `todayAvg > 0.07` AND `todayRecordCount >= 3` (minimum 3 records to avoid blocking on a single outlier)

The minimum-record guard (`>= 3`) prevents the system from blocking on day 1 of a weird single expensive call before enough data exists.

## New Hook: `useDailyCostGate`

Rather than overloading `useCostAlertMonitor` (which is super-admin only), we need a lightweight hook that **any authenticated user** can call to check if coaching is blocked. It runs a simple query:

```typescript
// Fetch today's api_costs for core pipeline (excl. TTS)
// Group by unique booking_id
// Calculate avg → compare to 0.07
// Return { coachingBlocked: boolean, todayAvg: number, isLoading: boolean }
```

The hook is **accessible to all roles** (agents, supervisors, etc.) because it only returns an aggregate — no individual booking cost details are exposed. However, it only queries `api_costs` which has an RLS policy of `super_admin` only.

**RLS Issue:** The `api_costs` table has `SELECT` restricted to `super_admin` only. Regular users (agents, supervisors) cannot query it. This means the daily gate check cannot be done client-side for non-admins.

**Solution:** Create a new database function `get_daily_coaching_gate()` with `SECURITY DEFINER` that returns only a boolean — whether today's avg exceeds $0.07. This function is accessible to all authenticated users but internally reads `api_costs` with elevated permissions, exposing no raw cost data.

```sql
CREATE OR REPLACE FUNCTION public.get_daily_coaching_gate()
RETURNS TABLE(is_blocked boolean, today_avg numeric, record_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ...
$$;
```

## Files to Change

| File | Change |
|---|---|
| **DB migration** (new) | Add `get_daily_coaching_gate()` RPC function — SECURITY DEFINER, returns `is_blocked`, `today_avg`, `record_count` for today |
| `src/hooks/useDailyCostGate.ts` | NEW — lightweight hook calling the RPC, returns `{ coachingBlocked, todayAvg, recordCount, isLoading }`, polls every 10 min |
| `src/components/coaching/CoachingAudioPlayer.tsx` | Accept `coachingBlocked?: boolean` prop; when true, replace "Generate" button/card with a disabled state + tooltip explaining why |
| `src/components/qa/QACoachingAudioPlayer.tsx` | Same — accept `coachingBlocked?: boolean` prop and disable generation when true |
| `src/pages/MyPerformance.tsx` | Use `useDailyCostGate()` hook, pass `coachingBlocked` to `CoachingAudioPlayer` |
| `src/pages/CoachingHub.tsx` | Same — pass `coachingBlocked` to `CoachingAudioPlayer` |
| `src/pages/MyQA.tsx` | Same — pass `coachingBlocked` to `QACoachingAudioPlayer` |
| `src/pages/QADashboard.tsx` | Same — pass `coachingBlocked` to `QACoachingAudioPlayer` |
| `src/components/billing/CostAlertBanner.tsx` | Add a line showing today's daily avg alongside the rolling avg, and a note if coaching is blocked |
| `src/components/layout/DashboardLayout.tsx` | If coaching is blocked AND user is super_admin, show a brief banner line about it |

## The `get_daily_coaching_gate()` Function

```sql
CREATE OR REPLACE FUNCTION public.get_daily_coaching_gate()
RETURNS TABLE(is_blocked boolean, today_avg numeric, record_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today_start timestamptz;
  v_today_avg numeric;
  v_count integer;
  MIN_RECORDS constant integer := 3;
  THRESHOLD constant numeric := 0.07;
BEGIN
  v_today_start := date_trunc('day', now() AT TIME ZONE 'UTC');
  
  SELECT 
    COALESCE(SUM(c.estimated_cost_usd) / NULLIF(COUNT(DISTINCT c.booking_id), 0), 0),
    COUNT(DISTINCT c.booking_id)::integer
  INTO v_today_avg, v_count
  FROM api_costs c
  WHERE c.is_internal = false
    AND c.service_type NOT LIKE 'tts_%'
    AND c.booking_id IS NOT NULL
    AND c.created_at >= v_today_start;
  
  RETURN QUERY SELECT
    (v_count >= MIN_RECORDS AND v_today_avg > THRESHOLD) AS is_blocked,
    COALESCE(v_today_avg, 0::numeric) AS today_avg,
    COALESCE(v_count, 0) AS record_count;
END;
$$;
```

## UX for Blocked State

When `coachingBlocked = true`, in place of "Generate" button/card:

- The player card turns grey/muted
- Shows a small lock icon + message: "Voice coaching paused — today's avg processing cost is above the $0.07 threshold. Audio generation will resume when costs normalize."
- Existing **already-generated** audio still plays normally — blocking only prevents new generation calls
- Super admins can still force-generate (optional: add an "override" button for super_admins only)

## Key Design Decisions

1. **Existing audio always plays** — The block only prevents new TTS calls. If audio was already generated, agents can still listen and take the quiz. This is important so agents already mid-coaching aren't interrupted.

2. **Minimum 3 records guard** — A single $0.20 call early in the morning doesn't block the whole day. Need at least 3 records to establish a meaningful daily average.

3. **Super admin override** — A small "Generate anyway (admin override)" link visible only to super_admins in case a specific coaching session is critically needed.

4. **SECURITY DEFINER function** — Exposes only an aggregate boolean/numeric to all users, not raw cost rows. No cost data leak.

5. **10-minute poll interval** — The `useDailyCostGate` hook refreshes every 10 minutes, slightly longer than the billing monitor's 5 minutes, to reduce DB load.
