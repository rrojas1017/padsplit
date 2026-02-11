

# Hard-Wired Cost Protection System

## What This Does

Adds a **cost ceiling** and **proactive alerting** system so that if any single record exceeds $0.07 (without TTS), or the rolling average exceeds $0.07, the system:

1. **Immediately fires a critical admin notification** visible to any super_admin on any page
2. **Logs every violation** with full details (which booking, what services ran, total cost)
3. **Shows a persistent warning bell** in the header with unread count for super admins

## Two-Layer Protection

### Layer 1: Post-Processing Cost Check (Edge Function)

After `transcribe-call` finishes all processing for a booking, add a cost audit step that:

- Queries `api_costs` for all entries with that `booking_id`
- Sums the total cost
- If TTS was skipped (`skipTts = true`) and total exceeds **$0.07**, immediately inserts a **critical** `admin_notifications` record with:
  - Title: "Cost Ceiling Breach: Booking [id]"
  - Message: "Record processed at $X.XX (limit: $0.07). Services: STT $X, AI $X, etc."
  - Severity: `critical`
  - Metadata: full cost breakdown per service type

This happens inside `processTranscription()` right after the "All automation triggers dispatched" log line (line ~1906).

### Layer 2: Rolling Average Monitor (New Edge Function)

Create a new edge function `monitor-cost-anomalies` that can be triggered:
- Automatically after each transcription completes (called from `transcribe-call` at the end)
- Checks the **last 20 records processed today** and calculates average cost per record (excluding TTS)
- If the rolling average exceeds $0.07, fires a critical notification

### Layer 3: Header Notification Bell (Frontend)

Update the Header component to show real-time unread notification count for super admins, making critical alerts visible from ANY page (not just the Billing tab).

## Technical Changes

### 1. `supabase/functions/transcribe-call/index.ts`
- Add a `auditBookingCost()` function after processing completes
- Queries `api_costs WHERE booking_id = X` and sums costs
- Excludes TTS costs (`service_type NOT LIKE 'tts_%'`) for the threshold check
- If non-TTS cost > $0.07, inserts critical `admin_notifications` record
- Also checks rolling average of last 20 bookings processed today

### 2. `src/components/layout/Header.tsx`
- Import `useAdminNotifications` hook
- Import `useAuth` to check if user is super_admin
- Show unread count badge on the Bell icon (currently static dot)
- Make bell clickable to navigate to `/billing` (costs tab with notifications)

### 3. `src/components/layout/DashboardLayout.tsx`
- Add a global critical notification banner at the top of the layout for super admins when there are unresolved critical notifications (appears on every page, not just Billing)

## Constants

```text
MAX_COST_PER_RECORD_NO_TTS = 0.07   (USD)
ROLLING_AVERAGE_WINDOW     = 20     (records)
```

These are hardcoded in `transcribe-call/index.ts` as constants, not configurable -- per your request to "hard wire" them.

## What the Super Admin Sees

When a cost breach happens:
1. **Bell icon turns red** with unread count on every page
2. **Red banner** appears at the top of any page they navigate to: "COST ALERT: Record X exceeded $0.07 ceiling ($0.XX actual)"
3. On the Billing page, the existing AdminNotifications card shows full details with metadata expandable
4. The notification persists until manually resolved

