

# Fix: Negative Margin Due to Missing Enabled Services

## Problem
The invoice shows $47.67 internal cost but only $15.30 billable, resulting in a -$32.37 loss. This happens because PadSplit's `enabled_services` only includes `["voice_processing", "text_processing"]`, so the other SOW categories that were actually performed (Voice Coaching at $0.55/record, Telephony at $0.012/min, etc.) are excluded from the invoice.

The $0.15/record voice processing rate alone can't cover the full pipeline cost (~$0.47/record when TTS coaching is involved). The SOW is designed so that Voice Coaching ($0.55/record) covers the expensive TTS audio generation — but it's not being billed because it's not in `enabled_services`.

## Fix

### 1. Update PadSplit's enabled services in the database
Add all applicable services to the client's `enabled_services` array:
- `voice_processing` (already enabled)
- `text_processing` (already enabled)
- `voice_coaching` -- this is the big one at $0.55/record covering TTS costs
- `telephony` -- $0.012/min for call minutes
- `email_delivery` -- $0.01/email
- `sms_delivery` -- $0.05/segment

This is a simple database UPDATE on the `clients` table.

### 2. Make Client Management UI easier to configure
The Client Management component already has service toggle controls. No code changes needed -- just the data fix.

## Expected Result After Fix
For the same Feb 1-9 period with 102 voice records:
- Voice Processing: 102 x $0.15 = $15.30
- Voice Coaching: 102 x $0.55 = $56.10
- Telephony: (total minutes) x $0.012
- **New total: ~$71+ vs $47.67 internal cost = positive margin**

## Change
- One database migration to update PadSplit's `enabled_services` to include all active service categories
