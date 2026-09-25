# BUG-007 — Non-Booking research calls wrongly marked "no conversation"

## What changes (plain terms)
- Research calls for scripts without a dedicated dashboard (today: Non-Booking, 30-Day Member Experience) get their own, fairer validity check: a per-script minimum length (45 s / 90 s) and only the AI summary is checked for "dead call" wording.
- Move-Out, Payment Experience, Audience Survey and all sales calls keep exactly today's check.
- A recording with no speech is marked "No audio" instead of "Failed", and is no longer counted or retried as a failure.

## Files touched
1. `supabase/functions/transcribe-call/index.ts`
2. `src/pages/Reports.tsx`, `src/components/booking/CallInsights.tsx` (labels only)
3. NEW `supabase/migrations/20260925170000_capture_bug007_script_min_duration.sql` (write only, exact content from the ticket, trailing newline, never run)
4. `roadmap.md` one Done line

Not touched: validateConversation and its lists, updateBookingError, process-research-record, submit-conversation-audio, generate-research-insights, batch-retry-transcriptions, cron, RLS, deps, Leaderboard/SiteFilter/useAgentGoals.

## Technical details

### A. New helpers (placed right after `validateConversation`, ~l.141)
```ts
const SR_ROUTE_SCRIPT_ID_MAP: Record<string, string> = {
  '6397bb7f-ac6a-49ea-90ad-9ca6ec046434': 'move_out_survey',
  'c701a243-1c66-425a-8f79-99a290ec5b6b': 'payment_experience',
};
const SR_BUILTIN_TYPES = ['move_out_survey', 'payment_experience', 'audience_survey'];
function srResolveCampaignType(s: { id: string; slug?: string | null }): string {
  if (SR_ROUTE_SCRIPT_ID_MAP[s.id]) return SR_ROUTE_SCRIPT_ID_MAP[s.id];
  if (s.slug && ['payment_experience', 'audience_survey'].includes(s.slug)) return s.slug;
  return s.slug || `script_${String(s.id).slice(0, 8)}`;
}
const SCRIPT_DEAD_CALL_SUMMARY_PHRASES = [ /* the 34 R4 phrases, verbatim */ ];
const SCRIPT_VOICEMAIL_INDICATORS = [ /* verbatim copy of validateConversation's voicemailIndicators (15) */ ];

function validateScriptResearchConversation(p: {
  durationSeconds: number | null; transcription: string; summary: string; minDurationSeconds: number;
}): { valid: boolean; reason: string } {
  const d = p.durationSeconds;
  if (d == null || d < 15) return { valid: false, reason: 'too_short_hard' };
  if (d < 30 && SCRIPT_VOICEMAIL_INDICATORS.some(i => p.transcription.toLowerCase().includes(i)))
    return { valid: false, reason: 'voicemail_short' };
  const s = (p.summary || '').toLowerCase();
  if (SCRIPT_DEAD_CALL_SUMMARY_PHRASES.some(i => s.includes(i))) return { valid: false, reason: 'summary_dead_call' };
  if (d < p.minDurationSeconds) return { valid: false, reason: 'below_script_minimum' };
  return { valid: true, reason: 'valid' };
}

async function updateBookingUnavailable(supabase: any, bookingId: string, message: string) {
  // same shape/error handling as updateBookingError, status 'unavailable'
}
```
The voicemail list is copied (not extracted) because validateConversation must stay byte-identical.

### B. Empty transcript (l.1665–1670)
```diff
-    // Guard: if transcription text is empty after STT processing, mark as failed
+    // Guard: if transcription text is empty after STT processing, mark as unavailable (no audio)
     if (!transcription || transcription.trim().length === 0) {
-      console.error(`... Marking as failed.`);
+      console.error(`... Marking as unavailable.`);
       clearTimeout(timeoutId);
-      await updateBookingError(supabase, bookingId, `STT returned empty transcript (${selectedProvider}). Audio may be silent or corrupted.`);
+      await updateBookingUnavailable(supabase, bookingId, `STT returned empty transcript (${selectedProvider}). Audio may be silent or corrupted.`);
       return;
     }
```

### C. Validation block (l.1865–1878) + one resolution
```diff
     // ===== CONVERSATION VALIDITY CHECK =====
-    let hasValidConversation = validateConversation({...});
-    // Research calls require a minimum 2-minute (120s) ...
-    if (hasValidConversation && isResearch && (...< 120)) { ...; hasValidConversation = false; }
+    // Resolve research script ONCE (deterministic chain); reused by survey progress.
+    let resolvedScriptId: string | null = null;
+    let resolvedQuestions: any[] | null = null;
+    let resolvedScript: { id: string; slug: string | null; min_valid_duration_seconds: number | null } | null = null;
+    if (isResearch) {
+      // bookings.research_call_id → research_calls.campaign_id → research_campaigns
+      //   .select('script_id, research_scripts!research_campaigns_script_id_fkey(id, slug, questions, min_valid_duration_seconds)')
+      // Same three "skipped (deterministic)" log lines and the "Deterministic script resolution" line as today.
+      // Wrapped in try/catch; on error resolvedScript stays null → legacy path.
+    }
+    const scriptType = resolvedScript ? srResolveCampaignType(resolvedScript) : null;
+    const useScriptValidator = isResearch && !!resolvedScript && !!scriptType && !SR_BUILTIN_TYPES.includes(scriptType);
+
+    let hasValidConversation: boolean;
+    if (useScriptValidator) {
+      const min = resolvedScript!.min_valid_duration_seconds ?? 120;
+      const r = validateScriptResearchConversation({ durationSeconds: callDurationSeconds, transcription, summary, minDurationSeconds: min });
+      console.log(`[Validation] script=${resolvedScript!.id.slice(0,8)} type=${scriptType} dur=${callDurationSeconds ?? 'null'} min=${min} result=${r.valid ? 'valid' : r.reason}`);
+      hasValidConversation = r.valid;
+    } else {
+      hasValidConversation = validateConversation({ durationSeconds: callDurationSeconds, transcription, summary });
+      // unchanged 120-s research minimum
+      if (hasValidConversation && isResearch && (!callDurationSeconds || callDurationSeconds < 120)) { /* same log */ hasValidConversation = false; }
+    }
```

### D. Survey progress (l.1886–1935)
The inner `bookings`/`research_calls`/`research_campaigns` lookups are removed; `questions = resolvedQuestions` and the existing `resolvedScriptId` is reused. The gate (`isResearch && hasValidConversation && transcription`), prompt, model and write stay as today. Logs are the same, now emitted once in C.

### E. Frontend status readers (bookings.transcription_status)
| File | What 'unavailable' shows today | Change |
|---|---|---|
| `src/pages/Reports.tsx` l.1266–1284 (row icon/title) | "Not transcribed" + headphones | title "No audio", same muted headphones icon |
| `src/pages/Reports.tsx` l.1605–1622 (insights button) | "Transcribe Call" | title "No audio" (the click still opens the modal, which already shows its unavailable screen) |
| `src/pages/Reports.tsx` l.358 CSV | raw "unavailable" | "No audio" |
| `src/components/booking/CallInsights.tsx` l.84–89 | no badge; no retry button | add outline badge "No audio"; retry stays hidden |
| `src/components/booking/TranscriptionModal.tsx` | already has its own "marked as unavailable" screen; no retry | none |
| `src/pages/Settings.tsx` l.103 failed count | not counted (`in failed,pending`) | none |
| `batch-retry-transcriptions` (server) | not selected (`null,failed,pending,queued`) | none |
| `ContactProfileHoverCard`, `followUpPriority`, `useReportsData`, `useDashboardData`, `BookingsContext`, `useMyBookingsData`, `useCoachingData` | pass-through / type only; no label or count | none |
| `useBulkProcessingJobs` (`is null`), STT/LLM comparison, MarketIntelligence (`= completed`) | excluded | none |
| `CallsTable`, `CallInsightsStats`, `CallDetailsModal` | read the separate `calls` table, not bookings | none |

### F. Checks after build
`deno check` transcribe-call (only the 3 old errors allowed), `tsgo --noEmit -p tsconfig.app.json`, deploy only transcribe-call, unsigned POST → 401, capture file wc/md5. No real recordings run; nothing published.
