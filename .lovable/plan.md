

## Add Pricing Discussion Detection to Call Analysis

### What This Does

Every call already goes through AI analysis that produces a summary, agent feedback, and key points. This change adds a new field -- `pricingDiscussed` -- to that analysis output, so you can see at a glance whether the agent covered pricing on each call.

### How It Works

The AI model already reads the full transcription. We simply ask it to also flag whether pricing was discussed, with three pieces of info:
- **mentioned** (yes/no): Did the agent proactively discuss pricing?
- **details**: What specifically was covered (e.g., "Agent quoted $185/week and explained the deposit structure")
- **agentInitiated**: Whether the agent brought it up vs. the member asking

This adds zero extra API calls -- it's just an additional field in the existing JSON response the AI already generates.

### Where You'll See It

1. **Booking detail view** (transcription modal): A pricing badge/indicator showing whether pricing was covered
2. **Reports table**: A small icon or badge on records where pricing was NOT discussed (similar to how detected issues are flagged)
3. **Agent feedback section**: Listed as a strength or improvement area

### Technical Changes

**1. AI Prompt Update** (`supabase/functions/transcribe-call/index.ts`)
- Add `pricingDiscussed` to the JSON schema in both prompt variants (standard and enhanced)
- Structure: `{ "mentioned": boolean, "details": "string", "agentInitiated": boolean }`
- This field will be stored inside the existing `call_key_points` JSONB column -- no database migration needed

**2. TypeScript Types** (`src/types/index.ts`)
- Add `pricingDiscussed` to the `CallKeyPoints` interface:
  ```
  pricingDiscussed?: {
    mentioned: boolean;
    details: string;
    agentInitiated: boolean;
  }
  ```

**3. Transcription Modal UI** (`src/components/booking/TranscriptionModal.tsx`)
- Add a small badge/section showing pricing discussion status
- Green badge "Pricing Discussed" with details, or amber "Pricing Not Mentioned" flag

**4. Reports Table** (`src/pages/Reports.tsx`)
- Add an optional pricing indicator icon on records where `call_key_points.pricingDiscussed.mentioned === false` to highlight missed opportunities

### What Won't Change
- No new database columns or migrations needed (stored in existing JSONB)
- No additional API calls or cost increase
- Existing records won't have this field (it only applies to newly transcribed calls)
- The backfill function (`batch-reanalyze-member-details`) could regenerate analysis for old records if desired later

