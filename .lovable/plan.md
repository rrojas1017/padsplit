

## Fix Nova-3 Comment References

Update code comments that incorrectly reference "Nova-3" to "Nova-2" for consistency with the actual Deepgram model being used.

### Summary

The project uses **Deepgram Nova-2** for transcription with AI Polish post-processing. Three code comments incorrectly reference "Nova-3" and need to be corrected for documentation accuracy.

### Changes

**File 1: `src/utils/billingCalculations.ts`**
- Line 13: `// Deepgram Nova-3 pricing` → `// Deepgram Nova-2 pricing`

**File 2: `supabase/functions/transcribe-call/index.ts`**
- Line 30: `// Deepgram Nova-3` → `// Deepgram Nova-2`
- Line 61: `// Deepgram Nova-3: ~$0.0043 per minute` → `// Deepgram Nova-2: ~$0.0043 per minute`

### Technical Notes

- Comment-only changes with no functional impact
- API calls already correctly use `model=nova-2`
- Pricing ($0.0043/minute) remains accurate for Nova-2
- Current pipeline preserved: Nova-2 STT → AI Polish (Flash-lite) → Final transcript

