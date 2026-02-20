
# Cost Alert System: Average Per-Record Cost > $0.07 for Super Admins

## What Currently Exists vs. What's Needed

The system already has a `auditBookingCost()` function inside `transcribe-call/index.ts` that:
- Checks a single record ceiling at $0.07 (non-TTS)
- Checks a rolling average of the last 20 records (today only)
- Writes to `admin_notifications` table when breached
- Shows alerts in the `Header` bell icon and `DashboardLayout` banner

**The critical gap:** The audit only runs when `skipTts = true` (line 2029-2032). Since most calls skip TTS (coaching audio is on-demand now), this should be triggering — but the `skipTts` gate means it silently skips audits for any call where TTS WAS included, and the rolling average window is scoped to today only, making it blind to sustained multi-day drift.

**What the user wants:** A persistent, visible alert when the rolling average cost per record (all services, including TTS) exceeds $0.07 — since PadSplit is charged $0.15/record, crossing $0.07 eats into the 53% margin.

## Specific Issues to Fix

### Issue 1: Audit gate blocks TTS-included records
The `if (!skipTts) return` on line 2029 means any record that included TTS coaching never gets audited. The gate should be removed — TTS costs absolutely count toward the $0.07 margin.

### Issue 2: Rolling average only checks TODAY
The rolling average query uses `gte('created_at', todayStart.toISOString())` which resets every midnight. A multi-day drift would never fire. It should look at the last N unique bookings regardless of date.

### Issue 3: The $0.07 threshold in memory says "excluding TTS" 
The memory note says "excluding TTS" but the user now explicitly wants to include ALL costs (TTS coaching adds ~$0.18/call which would always breach). The threshold needs context: **$0.07 for the core processing pipeline only** (STT + AI analysis + polishing + QA scoring), which is what we already exclude from TTS. The user's concern is today's average of $0.14 which was the bug-inflated duplicate — the real question is monitoring to ensure the baseline stays healthy.

### Issue 4: No UI visibility on the Billing page for this metric
The Billing dashboard has no explicit "Average Cost Per Record" alert card visible at a glance. The admin_notifications panel exists but is buried. We need a prominent alert card on the Billing page.

## What to Build

### Fix 1: Remove the TTS gate in `transcribe-call` audit
Remove the `if (!skipTts) return` check. Instead, separate the logic:
- Always audit the **total cost per record** (all services) against a separate reference point
- Keep the non-TTS ceiling check at $0.07 for the core pipeline
- Add a new alert type when TOTAL per-record (including TTS) exceeds the PadSplit margin threshold

### Fix 2: Fix rolling average to be date-agnostic
Change the rolling average query from `gte('created_at', todayStart)` to just fetching the last 500 cost rows and deduplicating by booking ID to get the last 20 unique bookings — regardless of when they were processed.

### Fix 3: Add `useCostAlertMonitor` hook
A new lightweight hook that:
- Fetches the last 20 processed bookings' total cost per record from `api_costs`
- Calculates the rolling average
- Returns an alert state: `normal` | `warning` | `critical`
  - Warning: avg > $0.05 (approaching limit)
  - Critical: avg > $0.07 (exceeding PadSplit margin)
- Polls every 5 minutes

### Fix 4: Add `CostAlertBanner` component to Billing page
A prominent banner at the top of the Billing page showing:
- Current rolling average (last 20 records)
- PadSplit charge reference ($0.15/record)
- Internal cost threshold ($0.07)
- Color-coded: green (healthy), amber (warning), red (critical)
- Shows breakdown: avg cost this period vs. threshold vs. PadSplit charge

### Fix 5: Enhance `DashboardLayout` banner
Update the existing critical alert banner to also show cost-per-record alerts (not just admin_notifications from the DB), using the new hook so super admins see it across ALL pages immediately.

## Files to Change

| File | Change |
|---|---|
| `supabase/functions/transcribe-call/index.ts` | Remove TTS gate; fix rolling average to be date-agnostic (last N records, not today) |
| `src/hooks/useCostAlertMonitor.ts` | NEW — hook to compute rolling avg cost per record from api_costs |
| `src/components/billing/CostAlertBanner.tsx` | NEW — prominent alert banner component for Billing page |
| `src/pages/Billing.tsx` | Add `CostAlertBanner` at top of page |
| `src/components/layout/DashboardLayout.tsx` | Integrate cost alert from hook into the global banner |

## Alert Thresholds

| Level | Condition | Message |
|---|---|---|
| Normal (green) | Avg ≤ $0.05 | "Avg cost: $X.XX/record — healthy" |
| Warning (amber) | $0.05 < avg ≤ $0.07 | "Avg cost approaching limit: $X.XX/record (limit $0.07)" |
| Critical (red) | Avg > $0.07 | "ALERT: Avg cost $X.XX/record exceeds $0.07 threshold — margin at risk!" |

## Technical Details

The `useCostAlertMonitor` hook will:
```typescript
// Query last 500 non-internal api_costs rows, group by booking_id
// Take the last 20 unique booking totals
// Calculate rolling avg
// Map to alert level
```

The hook runs only for super_admins (checks `hasRole(['super_admin'])` before querying) and refreshes every 5 minutes with a manual refetch option.

The `CostAlertBanner` on the Billing page will display a more detailed breakdown — not just the average but also a table showing the most expensive recent records, so the admin can immediately identify which bookings are driving up the cost.

The `DashboardLayout` global banner will remain minimal (just a one-line warning), while the full detail lives on the Billing page.
