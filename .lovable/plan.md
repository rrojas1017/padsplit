

# Fix Deepgram Cost Tracking

## Issue Found
The `api_costs` table has a CHECK constraint that only allows two providers:
```sql
CHECK ((service_provider = ANY (ARRAY['elevenlabs'::text, 'lovable_ai'::text])))
```

This is blocking Deepgram transcription costs from being saved to the database.

## Solution
Update the constraint to include `deepgram` as a valid service provider:

```sql
-- Drop existing constraint
ALTER TABLE api_costs DROP CONSTRAINT api_costs_service_provider_check;

-- Add updated constraint with deepgram
ALTER TABLE api_costs ADD CONSTRAINT api_costs_service_provider_check 
CHECK (service_provider = ANY (ARRAY['elevenlabs', 'lovable_ai', 'deepgram']));
```

## Impact
- All future Deepgram transcription costs will be properly tracked
- Existing data remains unchanged (5,438 records: 3,392 lovable_ai, 2,046 elevenlabs)
- A/B testing cost comparison will now work correctly

## Files to Change

| File | Change |
|------|--------|
| Database migration | Update CHECK constraint to include 'deepgram' |

## After Fix
You'll be able to see accurate cost comparisons in the Billing dashboard showing:
- Deepgram: ~$0.0043/min
- ElevenLabs: ~$0.034/min
- Actual savings per transcription

