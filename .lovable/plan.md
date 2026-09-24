# P5-GATE — nightly "skip when nothing new" + drift file

Files: `generate-research-insights/index.ts`, `analyze-member-insights/index.ts`, `analyze-non-booking-insights/index.ts`, new `supabase/migrations/20260924060000_capture_phase4_5_direct_changes.sql`. Nothing else. Auth guards untouched (lines 976 / 919 / 486 stay byte-identical). No SQL executed.

## Gate conditions (all three)
- `gated = body.automated === true && body.force !== true`
- Reason for the log line: `force === true` → `forced`; not automated → `manual`; no previous row → `no_previous`; otherwise `new_records`; skip → `no_new_records`.
- One line per request: `[Gate] skipped reason=no_new_records` or `[Gate] ran reason=<...>`. No ids of people, no names.
- Skip response: `200 {success:true, skipped:true, reason:'no_new_records', last_insight_id}` with corsHeaders; nothing inserted, no AI call.
- If a gate query errors: log `[Gate] ran reason=new_records` (fail-open — run as today).

## "Latest change" computation (via the client, no SQL)
`max(greatest(created_at, coalesce(updated_at,created_at), coalesce(x,created_at)))` equals the max of the individual column maxima (nulls ignored). So each is computed as up to three `order(col, {ascending:false, nullsFirst:false}).limit(1)` queries and the largest non-null timestamp wins (compared as `Date.getTime()`).

## 1) generate-research-insights (initial path only)
Insert a gate block between line 1092 (end of the `processedRecords.length === 0` return) and line 1094 (`const classifications`), i.e. after processedRecords, before any AI/insert (insert at 1186). Resume path (line 988) untouched.
- Previous: `research_insights` `.select('id, created_at, total_records_analyzed').eq('campaign_type', campaignType).eq('analysis_period', analysisPeriod).eq('status','completed').is('campaign_id', null).is('date_range_start', null).order('created_at',{ascending:false}).limit(1).maybeSingle()`
- (a) `booking_transcriptions` `.eq('research_campaign_type', campaignType).eq('research_processing_status','completed')` — max of `created_at`, `updated_at`, `research_processed_at`.
- (b) `research_prompts` max `updated_at` (none → -infinity, i.e. ignored).
- Skip when prev exists AND `prev.total_records_analyzed === processedRecords.length` AND `prev.created_at > a` AND `prev.created_at > b`. (If (a) has no rows, it counts as -infinity.)

## 2) analyze-member-insights
Insert gate after the INS-42 defaults and the start log (after line 941), before the processing-row insert at line 944.
- Previous: `member_insights` `.select('id, created_at').eq('analysis_period','allTime').eq('status','completed').order('created_at',{ascending:false}).limit(1).maybeSingle()`
- Scope = exactly today's fetch filters (lines 222–228): `transcription_status='completed'`, `record_type='booking'`, `status` not `Non Booking`/`Research`, `booking_date` between `date_range_start` and `date_range_end`.
- Latest change: max of `bookings.created_at`, `bookings.updated_at` (bookings query with `booking_transcriptions!inner(id)` + scope filters) and `booking_transcriptions.updated_at` (bt query with `bookings!inner(id)` + the same filters on `bookings.*`).
- Skip when prev exists AND `prev.created_at > latest`.

## 3) analyze-non-booking-insights
Insert gate after the missing-params check (after line 505) and before the insert at line 521.
- Previous: `non_booking_insights` same shape as member.
- Scope: `bookings.status='Non Booking'` inner-joined to booking_transcriptions (as specified; date bounds from the INS-42 defaults applied too, matching what is analysed).
- Same latest-change and skip rule.

## 4) Migration file
Write `supabase/migrations/20260924060000_capture_phase4_5_direct_changes.sql` with exactly the supplied content via a quoted heredoc (`<<'EOF'`), then verify with `diff` against the supplied text. Not applied.

## Verification
- `deno check` the 3 functions (generate-research-insights' 4 pre-existing errors expected, no new ones).
- Deploy the 3; unsigned `POST {}` → 401 each.
- No automated/real runs — the user runs those. Nothing published.
