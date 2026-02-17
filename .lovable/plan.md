

## Switch Coaching Audio to On-Demand Generation

### What's Changing

Currently, every time a call is transcribed, the system automatically generates both Jeff's and Katty's voice coaching audio. This involves calling ElevenLabs for text-to-speech on every single record -- which is the most expensive step in the pipeline (roughly $0.18 per Jeff audio and $0.16 per Katty audio).

Going forward, coaching audio will only be generated when an agent actually clicks "Play Coaching" or "Listen to Katty's QA Coaching." This means you only pay for audio that someone actually listens to.

### What Stays the Same

- **Transcription** still happens automatically
- **QA Scoring** still happens automatically (this is cheap AI text analysis, not audio)
- **Jeff's written feedback** (call key points, agent feedback) still generated automatically
- **Katty's written QA scores** still generated automatically
- The coaching audio players already have "generate" buttons built in -- agents won't notice any difference in their workflow

### Cost Impact

If only 30% of agents actually listen to their coaching audio, this change would reduce TTS costs by roughly 70%. At current volumes, that's a meaningful saving since TTS coaching is the single most expensive line item per record.

### Technical Changes

**File: `supabase/functions/transcribe-call/index.ts`**
- Remove the automatic call to `generate-coaching-audio` (Jeff's audio) from the post-transcription pipeline
- Remove the automatic call to `generate-qa-coaching-audio` (Katty's audio) from the post-transcription pipeline
- Keep the QA scoring step (`generate-qa-scores`) -- this is text-only analysis and stays automatic
- The pipeline becomes: Transcription -> AI Analysis -> QA Scoring (done). No more automatic TTS.

**File: `supabase/functions/fix-incomplete-bookings/index.ts`**
- Update the recovery function to no longer treat "missing coaching audio" as an incomplete booking that needs fixing
- It should still recover missing transcriptions and QA scores, but not auto-generate audio

**No frontend changes needed** -- both `CoachingAudioPlayer` and `QACoachingAudioPlayer` already handle the case where no audio URL exists by showing a "Generate" / "Play Coaching" button that triggers on-demand generation.

### How It Works for Agents

1. Agent opens a booking's details
2. They see "Listen to your coaching" (Jeff) or "Listen to Katty's QA Coaching" cards
3. They click to play -- the system generates the audio right then (takes a few seconds)
4. Audio plays automatically once ready
5. Quiz flow continues as normal after listening

This is the exact same experience agents already see when audio hasn't been generated yet -- we're just making that the default path instead of the exception.

