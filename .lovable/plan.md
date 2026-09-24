# BUG-003 Phase B — AI summaries for scripts without a dashboard, plus the scale fix

No migrations, no RLS changes, no new dependencies, no publish. Files not touched: Leaderboard, SiteFilter, useAgentGoals, Reports files, and the two submission functions. The only function deployed is generate-research-insights.

Checked beforehand: the two scripts exist, are active and have no slug. Their resolved types are `script_c24c5e6b` (30-Day Member Experience) and `script_827b23ef` (Non-Booking Conversion).

## 1. supabase/functions/generate-research-insights/index.ts

### How move-out and audience stay untouched
- The new code is a separate function, `runScriptMode(...)`, added above `Deno.serve` (before line 988).
- In `Deno.serve` there is one early branch, placed right after the `resume` block (after line 1020) and before line 1022 ("INITIAL path"):
  ```ts
  const rawType = body.campaignType || body.campaign_type;
  if (typeof rawType === 'string' && /^script_[0-9a-f]{8}$/.test(rawType)) {
    return await runScriptMode(supabase, lovableApiKey, auth.ctx, body, rawType);
  }
  ```
- `move_out_survey`, `audience_survey`, `payment_experience`, a missing type (which defaults to move-out) and `resume` never match the regex. They run the existing lines 1022–1302 byte-for-byte unchanged.
- The auth guard stays the same: `requireUserOrInternal(req, MANAGERS)` at line 993, still before the branch. The nightly cron with `x-internal-secret` works exactly as today.
- No existing helper, prompt or gate is edited. The new code reuses `callLovableAI` (line 682) and `logApiCost` as they are.

### How runScriptMode works
1. **Check the request.** `script_id` must be a UUID, otherwise 400. Load `research_scripts` (id, name, slug, questions) with the service-role client; if not found, 404. If `resolveResearchCampaignType(script) !== campaign_type`, return 400 "campaign_type does not match script". A local copy of the same rule goes in the function file: the move-out and payment ID map, then slug, then `script_<id8>`.
2. **Load records.** `bookings.select('id, booking_date, created_at, research_call_id, booking_transcriptions!inner(research_extraction, survey_progress, call_summary, updated_at, research_campaign_type)')` filtered on `record_type='research'`, `has_valid_conversation=true` and `booking_transcriptions.research_campaign_type = campaign_type`. Paged with `.range()` in steps of 1000 until a short page. No filter on processing status or classification.
3. **Gate.**
   - Fewer than 3 eligible records: return `{ skipped: true, reason: 'not_enough_records', eligible }`.
   - Unless `force === true`: find the latest `research_insights` row with this campaign_type and status 'completed'. If it exists and no record has `created_at` or transcription `updated_at` later than its `generated_at`, return `{ skipped: true, reason: 'no_new_records', eligible, last_insight_id }`.
   - Log one line, same style as today, e.g. `[Gate] script skipped reason=...` or `[Gate] script ran reason=forced|new_records|no_previous`. No personal data in the log.
4. **Stats, computed in code.** Uses the script questions minus `is_internal`, matched to answers by stable id (`q.id`, else index, same as the answer writers).
   - multiple_choice, multiple_select, yes_no: counts per label.
   - scale: n, average (2 decimals), distribution from `scale_min` (default 1) to `scale_max` (default 10).
   - open_ended: trimmed texts, at most 300 characters each and 150 per question.
   - Totals: records, completed vs ended early (from `survey_progress.ended_early`), average answered and average total.
   - `other_notes`: `call_summary` of records that have no raw answers, at most 100.
5. **Prompt.** Load `research_prompts` where `prompt_key = 'aggregation_' + campaign_type` (optional). Its `prompt_text` is the survey focus; its model and temperature override the defaults `google/gemini-2.5-flash` and 0.2.
   - System prompt holds the fixed instructions you listed plus the required JSON shape.
   - User prompt holds the script name, focus text, stats JSON (open answers removed) and the open answers grouped by question.
6. **Save and call the AI.**
   - Insert a `research_insights` row: campaign_type, insight_type 'aggregate', caller_type 'all', status 'processing', analysis_period 'allTime', total_records_analyzed, created_by (caller id, or null for internal calls), `data: { mode: 'script', script_id }`.
   - Then run `callLovableAI` and log the cost with `logApiCost` (service_type 'research_aggregation', `metadata { model, prompt: 'script_mode', campaign_type }`, triggered_by_user_id, is_internal). The cost is only logged when the AI replied.
7. **Validate.** Strip code fences and parse the JSON, then check the shape: executive_summary is a string; each list is an array with the listed fields; strength, severity and priority come from the allowed values; share_pct is a number or null; data_quality_notes is a string.
   - Valid: update the row to 'completed' with `data: { mode, script_id, stats, report }` and `generated_at = now()`.
   - Invalid, or the AI call errors: update to 'failed' with a short error_message.
   - Return `{ success: true, insight_id }` or `{ success: false, insight_id, error }`.
   - This runs in the same request with no background chaining. The data is small and one call is enough.

## 2. src/components/research-insights/ScriptInsightsPanel.tsx
- **Scale fix.** The questions mapping (lines ~49–62) also carries `id: q.id`, `scale_min: q.scale_min ?? undefined` and `scale_max: q.scale_max ?? undefined`, keeping every current field. ScriptResultsOverview (line 36) and DynamicQuestionCard (lines 48 and 92) already read `scale_max`, so "Avg Rating x/5" follows with no change to those files.
- **New "AI Summary" tab**, shown to super_admin, admin and supervisor.
  - `campaignType = resolveResearchCampaignType(script)` from `src/utils/researchCampaignType.ts`.
  - Query the latest `research_insights` row (id, status, error_message, generated_at, total_records_analyzed, data) by campaign_type, ordered by created_at desc, limit 1. `refetchInterval` is 5 s while status is 'processing' and polling is under 3 minutes.
  - Shows: generated time (ET) and records analysed, then the executive summary, key findings with a strength badge, section insights with quotes, top issues with share and severity, recommendations with priority, and the data-quality note.
  - Failed row: show its error. No row: "No AI summary yet".
  - The report is read defensively: missing or odd fields are skipped, never a crash.
- **"Generate / Refresh" button**, super_admin and admin only.
  - It sends `supabase.functions.invoke('generate-research-insights', { body: { campaign_type, script_id, force: true } })`.
  - Skip replies become toasts: not_enough_records shows "At least 3 submissions are needed"; others show the reason.
  - Errors show the JSON error. Success refetches the row.
- Existing tabs, the Submissions tab and the empty-state logic are unchanged.

## 3. roadmap.md
One Done line for BUG-003 Phase B.

## Verification
- tsgo clean. deno check generate-research-insights: I expect only its 4 existing errors (the `description`, `details`, `booking_ids` and `reason_codes_included` reads on `object`) and no new ones.
- Deploy only generate-research-insights. An unsigned POST {} should return 401.
- A wrong script_id and campaign_type pair should return 400. This makes no AI call, so I can test it with a signed-in session.
- I will not make the paid forced run or the second no-force call. You run those, plus the move-out nightly check.

## Notes and possible conflicts
- Supervisor access to `research_insights` in the database was not checked. If their access rule blocks the read, supervisors will see "No AI summary yet".
- The gate in this mode compares against the latest completed row for the campaign_type, whatever its analysis_period, as your spec says.
- `callLovableAI` sends `max_tokens` and a json_object response format. That is today's helper and works for Gemini; it is reused as is.
