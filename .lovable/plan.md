# P-G1 — Daily cost gate, nightly insights dates, DeepSeek model, drift capture

Only the 6 functions below plus one new migration file change. Auth guards stay byte-identical. No RLS, config.toml or SQL execution. Nothing published, and no function is called for real.

## 1a. Daily cost gate in both audio generators

**generate-coaching-audio/index.ts**: insert right after the "already exists" early return (after line 163, before line 165 `const agentFeedback`).
**generate-qa-coaching-audio/index.ts**: insert after line 171 (the end of the early return), before the `qa_scores` check at line 173.

Block inserted in both files:
```ts
const isSuperAdminCaller = auth.ctx.kind === 'user' && auth.ctx.role === 'super_admin';
if (!isSuperAdminCaller) {
  const { data: gateRows, error: gateErr } = await supabase.rpc('get_daily_coaching_gate');
  if (gateErr) {
    console.error('[CostGate] RPC failed, continuing (fail-open):', gateErr.message);
  } else {
    const gate = Array.isArray(gateRows) ? gateRows[0] : gateRows;
    if (gate?.is_blocked) {
      return new Response(JSON.stringify({ success: false, blocked: true, reason: 'daily_cost_gate',
        todayAvg: Number(gate.today_avg ?? 0), recordCount: Number(gate.record_count ?? 0) }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }
}
```
`supabase` is already the service-role client in both files (lines 125 and 123). Internal secret callers have no role, so they are gated too. Both files already contain an `isInternal` variable (same expression), but a new name keeps it clear.

## 1b. Sentiment (generate-coaching-audio only)
Line 185: `callKeyPoints?.sentiment || "positive"` → `callKeyPoints?.callSentiment ?? callKeyPoints?.sentiment ?? 'neutral'`. Add `callSentiment?: string;` next to `sentiment?: string;` in the type at line 176.

## 1c. batch-generate-qa-coaching/index.ts
- Top of file (after imports): `declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };`
- After `createClient` (line 67), before the select: the gate RPC (fail-open). If blocked, return 200 `{success:false, blocked:true, queued:0, message:'Daily cost gate active'}`.
- Selector at lines 70-74: add `.is('qa_coaching_audio_generated_at', null)`.
- Loop (lines 109-116): if `response.status === 429`, log `[CostGate] Blocked mid-batch, stopping`, then `break`. The break also skips the 10 s wait.
- Line 132 `processInBackground();` → `EdgeRuntime.waitUntil(processInBackground());`. The immediate response with `queued` stays unchanged.

## 2. Nightly insights with no dates (INS-42)
Helper used in both files: `new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())` gives yyyy-MM-dd.

**analyze-member-insights/index.ts** line 976: change `const {...} = await req.json()` → `let` (same default `'manual'`, same names). Right after it:
```ts
if ((!date_range_start || !date_range_end) && (!body.analysis_period || analysis_period === 'allTime')) {
  date_range_start = '2024-01-01'; date_range_end = <today NY>; analysis_period = 'allTime';
}
```
The check tests the raw body for "missing", because the destructured default turns a missing period into 'manual'. The body is read once into `body`. Other periods keep today's behaviour.

**analyze-non-booking-insights/index.ts** line 465: same change to `let`, with the same defaulting inserted before the existing 400 check at line 467. That check stays as it is for other periods.

## 3. compare-llm-providers/index.ts
Lines 139, 168, 285: `"deepseek-chat"` → `"deepseek-v4-flash"`. Nothing else changes.

## 5. Drift-capture migration file
Create `supabase/migrations/20260924040000_capture_phase2_3_direct_changes.sql` with exactly the content provided, byte for byte. The file editor is blocked under `supabase/migrations/`, so it is written with a quoted shell heredoc (`<<'EOF'`, so no expansion), as done in Phase 2. It is not executed and not applied. Integrity check afterwards: head and tail match, plus byte size.

## Verification
- `deno check` on all 6 changed functions. Pre-existing warnings are reported separately.
- Deploy: generate-coaching-audio, generate-qa-coaching-audio, batch-generate-qa-coaching, analyze-member-insights, analyze-non-booking-insights, compare-llm-providers.
- No real calls. Only an optional anon-key POST {} to confirm the auth guards still return 401.
