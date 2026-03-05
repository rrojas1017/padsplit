

# Fix: Register and Trigger backfill-survey-progress

## Problem
The `backfill-survey-progress` edge function exists in code but is not registered in `supabase/config.toml`, so it returns 404 when called.

## Changes

### 1. `supabase/config.toml`
Add at the end:
```toml
[functions.backfill-survey-progress]
verify_jwt = false
```

### 2. Deploy and trigger
After the config is updated:
1. Deploy the function
2. Dry run first: `POST /functions/v1/backfill-survey-progress` with `{"dryRun": true}` to see how many records need processing
3. Trigger the actual backfill: `POST /functions/v1/backfill-survey-progress` with `{}`
4. The function self-retriggers in batches of 20 until all valid research records with transcriptions are processed

No code changes needed to the function itself -- it already filters for `record_type = 'research'`, `has_valid_conversation = true`, and non-null transcriptions with null `survey_progress`.

