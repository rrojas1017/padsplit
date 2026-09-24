# P-C — Research pipeline fixes (4 edge functions only)

Scope: only the 4 files below. No migrations, RLS, config.toml, src/**, prompts, models or cost logging. Existing auth guards stay byte-identical. Response fields only added, never renamed/removed.

## 1. process-research-record/index.ts
- Before `try {` (line 1036): add `let bookingId: string | undefined;`.
- Line 1037 `const { bookingId } = await req.json();` becomes:
  `const body = await req.json().catch(() => ({}));` and `bookingId = body?.bookingId;` (the `Missing bookingId` throw on 1038 stays).
- Lines 1091-1094 (mark processing): payload becomes `{ research_processing_status: 'processing', updated_at: new Date().toISOString() }`.
- Lines 1311-1318 (completed payload): add `updated_at: new Date().toISOString()`.
- Lines 1352-1362 (catch): delete the `req.clone().json()` block; replace with: if `bookingId`, `update({ research_processing_status: 'failed', updated_at: now }).eq('booking_id', bookingId).eq('research_processing_status', 'processing')`, wrapped in try/catch. 500 response unchanged.

## 2. batch-process-research-records/index.ts
- Lines 74 and 113: replace the `.or('...is.null,...eq.failed', {referencedTable})` with `.is('booking_transcriptions.research_processing_status', null)`.
- Line 126 in-memory filter: only `!t?.research_processing_status`.
- Line 89 stale reset: `update({ research_processing_status: 'failed', updated_at: now })`.
- Body flag: `const includeFailed = body.includeFailed === true;` (after line 26). dryRun branch unchanged (runs first). When `includeFailed`, `EdgeRuntime.waitUntil(runFailedOnce(...))` instead of `runOneBatch`; same response shape (`success`, `message`).
- New `runFailedOnce`: select up to 5 research bookings (same valid-conversation + non-empty transcript filters) with `research_processing_status = 'failed'`, call process-research-record for each (same fetch/headers/parallel pattern as lines 139-170), log counts, and never call `selfRetrigger`. Extract the existing per-record call loop into a shared helper so both paths use it unchanged.

## 3. generate-research-insights/index.ts (initial path, lines 1042-1066)
- Add `survey_progress` to the embedded `booking_transcriptions!inner (...)` select.
- Line 1061 compares `research_call_id` to a campaign id — replace: if `campaignId`, fetch `research_calls.id` where `campaign_id = campaignId` (paged by 1000); if none, treat as zero records (existing empty-records handling); else `.in('research_call_id', ids)` (chunked to 500 ids per request if needed, results concatenated).
- Replace the single `await query` (line 1065) with a loop: build the query per page and `.order('id').range(from, from + 999)` until a page returns < 1000 rows; concatenate into `records`. Error handling unchanged.

## 4. persist-research-raw-answers/index.ts
Guard block (lines 13-46: requireUser(RESEARCH) + researcher owns call) untouched. Then:
- Load `research_calls` (service role): `id, campaign_id, researcher_id, caller_name, caller_phone, researcher_notes, call_duration_seconds, language, call_outcome`; missing → 404 `{error:'Research call not found'}`.
- Find booking by `research_call_id` (existing lookup, lines 48-64). If none:
  a) if caller_phone: last-10 digits; select research bookings with `research_call_id IS NULL`, `contact_phone ilike %<digits>` (digits-only value, safe), newest first, limit 5; pick first with `member_name` starting "API Submission" or `import_batch_id='api-submission'`; update `member_name, research_call_id, notes, call_duration_seconds`.
  b) else, only if `call_outcome` is `'completed'` or null: first active agent; insert `{record_type:'research', research_call_id, member_name: caller_name, booking_date/move_in_date: today, booking_type:'Research', status:'Research', agent_id, contact_phone, created_by: auth.ctx.userId, notes, call_duration_seconds}` → `created_booking = true`.
  c) still no booking → keep today's `{ok:true, merged:false, reason:'no_booking'}`.
- booking_transcriptions: if no row → insert `{booking_id, research_extraction:{ raw_script_answers }}`; else today's merge (existing keys win).
- script_responses (skip entirely if `campaign_id` missing, or the campaign has no `script_id`): if any rows already exist for `session_id = research_call_id` → skip. Else load `research_scripts.questions`, map question id → `order`; for each entry in raw_script_answers insert `{script_id, session_id, question_order, response_value, response_options: selected_option_labels, response_numeric: scale_value, metadata:{question_id, question_type, source:'agent_runtime', language}}`; then update the script `total_responses + 1`, `last_response_at = now()` (read-then-write). Failures here are logged, non-fatal.
- Response: existing `ok, merged, booking_id, count` plus optional `created_booking`.

## Technical notes / assumptions
- `research_calls.campaign_id` → `research_campaigns.script_id` is how the script is found (the call has no script column).
- `response_value`: text answer, or the joined option labels / numeric string when no free text.
- Deploy: `deno check` on all 4, deploy all 4, anon-key POST `{}` each (expected 401).
