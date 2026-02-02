
# Switch to Deepgram-Only Transcription

## Current State
The system uses A/B testing between ElevenLabs and Deepgram with a **50/50 weight split** in the `stt_provider_settings` table:
- `deepgram`: weight 50, is_active: true
- `elevenlabs`: weight 50, is_active: true

This explains why 4 out of 5 calls today still used ElevenLabs despite Deepgram being configured.

## Solution
Update the database settings to route **100% of new transcriptions to Deepgram**:

| Provider | Current Weight | New Weight | is_active |
|----------|---------------|------------|-----------|
| deepgram | 50 | 100 | true |
| elevenlabs | 50 | 0 | true (kept for fallback) |

## Database Migration

```sql
-- Set Deepgram as the sole STT provider (100% weight)
UPDATE stt_provider_settings 
SET weight = 100, updated_at = now() 
WHERE provider_name = 'deepgram';

-- Disable ElevenLabs for STT by setting weight to 0
UPDATE stt_provider_settings 
SET weight = 0, updated_at = now() 
WHERE provider_name = 'elevenlabs';
```

## Cost Impact

Based on today's data (4 ElevenLabs calls = $1.20):
- **Current rate (ElevenLabs)**: $0.034/min
- **New rate (Deepgram)**: $0.0043/min
- **Savings per call**: ~87%

For the same 35 minutes processed today:
- ElevenLabs cost: $1.20
- Deepgram cost: $0.15
- **Daily savings**: ~$1.05

## Technical Notes

1. **No code changes required** - The `selectSTTProvider` function in `transcribe-call/index.ts` already reads weights from the database
2. **AI polishing preserved** - Deepgram transcripts will continue to be polished by Lovable AI to fix brand names like "PadSplit"
3. **ElevenLabs kept as fallback** - Setting weight to 0 (not deleting) allows quick revert if needed
4. **TTS unchanged** - ElevenLabs will still be used for Jeff and Katty voice generation (TTS), only STT changes
