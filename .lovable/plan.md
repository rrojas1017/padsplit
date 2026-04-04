
Goal: make Coaching Hub show today’s coaching records that already exist.

What I found
- This is not primarily a timezone/RLS problem anymore.
- The database already has 4 Apr 3 coaching-ready rows: transcript present and `agent_feedback` present.
- The frontend request is returning 200, so access is working.
- The real bug is in `src/hooks/useCoachingData.ts`: it orders by `coaching_audio_generated_at desc nullslast`.
- Today’s 4 rows have `coaching_audio_generated_at = null`, so they get pushed behind all rows that do have audio.
- There are 6,358 coaching rows total, and 1,279 audio rows sort ahead of any null-audio row.
- The API only returns the first 1,000 rows by default, so today’s 4 rows never reach the browser.

Implementation plan

1. Fix `src/hooks/useCoachingData.ts`
- Replace the single query with paginated `.range()` fetching so coaching data is not silently capped at 1,000 rows.
- Change the server-side order to `updated_at desc` instead of `coaching_audio_generated_at desc`.
- Keep filtering on `agent_feedback is not null` and excluding research records.
- After mapping, sort in JS by a derived analysis timestamp:
  `coaching_audio_generated_at ?? updated_at ?? created_at ?? booking_date`
- This keeps recent coaching visible even when audio has not been generated yet.

2. Keep Coaching Hub filtering on coaching-analysis time
- Leave the Eastern-time date logic in place.
- Continue filtering Coaching Hub by the derived coaching reference date, not raw booking date.

3. Improve empty-state messaging in `src/pages/CoachingHub.tsx`
- Update the empty/help text so it explains that Coaching Hub shows calls with coaching feedback, not just completed transcripts.
- This avoids confusion when transcripts exist but coaching analysis has not been generated yet.

Validation
- Confirm Apr 3 shows the 4 expected coaching records.
- Confirm “Today” and “Last 7 Days” both include them in Eastern time.
- Confirm “All Time” still shows older coaching records.
- Confirm Coaching Engagement / My Performance still behave correctly with audio-specific fields.

Files to change
- `src/hooks/useCoachingData.ts` — main fix
- `src/pages/CoachingHub.tsx` — clearer messaging only

Technical details
- Root cause: default API row cap + `nullslast` ordering.
- No backend schema or RLS changes are needed for this fix.
