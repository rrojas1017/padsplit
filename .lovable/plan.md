

# Backfill Extracted Member Details to Research Records

## Problem
The AI analysis already extracts names, emails, market city/state, and other details from call transcriptions into `call_key_points.memberDetails`. However, for the 91 existing research records, most of this data was never written back to the bookings table columns (`member_name`, `contact_email`, `market_city`, `market_state`).

- 77/91 records missing market city (but ~15+ have it in `memberDetails`)
- 77/91 records missing contact email (a few have it extracted)
- Most still show "API Submission - +phone" as member name (but names like "Emily", "Tony", "Janae Williams" are in the transcription data)

## Solution
Create and run a one-time backfill that reads `call_key_points.memberDetails` from `booking_transcriptions` and writes the extracted values back to the `bookings` table — only filling in fields that are currently empty/placeholder.

### 1. New edge function: `backfill-member-details`
- Query all research records where `call_key_points.memberDetails` exists in `booking_transcriptions`
- For each record, check if the booking is missing data that the AI already extracted:
  - `member_name`: if still "API Submission - ..." and firstName/lastName available, update
  - `contact_email`: if null and email extracted (skip bogus values like descriptions)
  - `market_city` / `market_state`: if null and extracted
- Process in batches of 50, self-retrigger pattern
- Dry run support to preview counts

### 2. Register in `supabase/config.toml`
```toml
[functions.backfill-member-details]
verify_jwt = false
```

### 3. Execute
1. Deploy function
2. Dry run to see how many records can be enriched
3. Run the actual backfill

No UI changes needed — the Reports table already displays `member_name`, `market_city`, `contact_email` columns, so enriched data will appear immediately.

