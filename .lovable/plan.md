

# Fix: Only Bill Telephony for Platform-Originated Calls

## Problem
Currently, `fetchPeriodCounts` bills telephony minutes for ALL bookings in the period -- including ones that were uploaded or imported from external sources. Telephony should only be charged when the platform's own services (Telnyx/Kixie) originated the call. Uploaded recordings were transcribed by the platform (billable as voice processing), but the actual phone minutes were not provided by the platform.

## How to Identify Platform vs. External Records
The `bookings` table has an `import_batch_id` column:
- **NULL** = booking was created through the platform (live call via Kixie webhook or manual entry with platform telephony)
- **Non-NULL** = booking was imported/uploaded from an external source

Right now, all 39 bookings in the Feb 1-10 period are imported (`import_batch_id IS NOT NULL`), meaning zero telephony should be billed for that period.

## What Should and Shouldn't Be Billed for Imported Records

| Service | Bill for Imports? | Reason |
|---|---|---|
| Voice Processing (AI analysis) | Yes | Platform performed the STT and AI work |
| Text Processing | Yes | Platform performed the analysis |
| Voice Coaching (TTS audio) | Yes | Platform generated the coaching audio |
| Email/SMS Delivery | Yes | Platform sent the communications |
| **Telephony** | **No** | Platform did not originate or carry the call |

## Change

### File: `src/hooks/useBillingData.ts`
In `fetchPeriodCounts`, modify the bookings query to also fetch `import_batch_id`, then only sum telephony minutes for bookings where `import_batch_id IS NULL` (platform-originated calls).

Specifically:
1. Change the bookings query from `.select('id')` to `.select('id, import_batch_id')`
2. Create a set of platform-originated booking IDs: those where `import_batch_id` is null
3. When calculating `telephonyMins`, only sum `audio_duration_seconds` from `api_costs` rows whose `booking_id` is in the platform-originated set
4. All other counts (voice, text, coaching, email, SMS) remain unchanged since the platform did perform that work

### Expected Impact
- Imported/uploaded bookings: telephony = $0 (correct -- we didn't provide the phone service)
- Platform-originated bookings: telephony billed normally at $0.012/min
- All other line items unaffected

