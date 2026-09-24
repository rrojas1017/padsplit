# P5-SEC correction — bulk-transcription-processor continue ordering

File touched (only one): `supabase/functions/bulk-transcription-processor/index.ts`
No other changes. Auth helpers (`_shared/auth.ts`) untouched. No migrations/RLS/config.toml. Do not publish. Only unsigned / `POST {}` checks after deploy.

## Defect (verified live)

A signed-in super_admin POSTing `{action:'continue', jobId:'00000000-0000-0000-0000-000000000000'}` gets `400 "Job not found"` instead of `403 Forbidden`.

Root cause: the shared job lookup runs before the internal-only check reaches it.
- Line 460: `auth = requireUserOrInternal(req, ADMINS)` → passes for an admin.
- Lines 469: body parsed → `{ jobId, action = 'start' }`.
- Lines 471–473: `if (!jobId) throw 'Missing jobId'` (input validation, pre-lookup).
- Lines 475–484: job lookup → `throw new Error('Job not found')` for a bogus id → caught at 623 → `400`.
- Lines 572–575: `case 'continue'` internal check only runs if the lookup succeeded, so it never fires for the bogus-id case.

## Fix

Move the internal-only guard to right after the body parse (before `!jobId` and before the job lookup); delete the now-redundant check inside `case 'continue'`.

### Edit 1 — insert guard after body parse (after line 469, before line 471)

Current:
```ts
    const { jobId, action = 'start' } = await req.json() as JobConfig;
    
    if (!jobId) {
      throw new Error('Missing jobId');
    }
```

New:
```ts
    const { jobId, action = 'start' } = await req.json() as JobConfig;

    // Internal self-chaining continuation only. Must run before any job lookup
    // so a user (even super_admin) cannot drive the continuation of a real id.
    if (action === 'continue' && auth.ctx.kind !== 'internal') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!jobId) {
      throw new Error('Missing jobId');
    }
```

### Edit 2 — remove the redundant check inside `case 'continue'` (lines 572–575)

Current:
```ts
      case 'continue': {
        if (auth.ctx.kind !== 'internal') {
          return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        // Internal action - just start the next chunk
        EdgeRuntime.waitUntil(
```

New:
```ts
      case 'continue': {
        // Internal action - just start the next chunk
        EdgeRuntime.waitUntil(
```

## Why the self-chain keeps working

`runProcessingLoop` self-retriggers at lines 424–434 with `Authorization: Bearer ${supabaseServiceKey}`. `_shared/auth.ts` recognizes the service-role bearer as an internal caller, so `auth.ctx.kind === 'internal'` and the new guard passes — no change to the self-call needed.

## Behavior preserved for legitimate callers

- `start` / `resume` / `pause` / `stop`: unchanged — all admins still pass `requireUserOrInternal(req, ADMINS)`, and none of them hit the `action === 'continue'` branch.
- `continue` from the internal self-call: still allowed.
- Only change: a non-internal (user) caller posting `action:'continue'` now always gets `403 Forbidden`, regardless of whether the `jobId` is valid, missing, or nonexistent.

## After implementation

1. `deno check supabase/functions/bulk-transcription-processor/index.ts` — expect clean (no new deps/types).
2. Deploy only `bulk-transcription-processor`.
3. Unsigned `POST {}` → expect `401` (platform sign-in gate before the function's own guard), per the standing rule.
4. Report.
