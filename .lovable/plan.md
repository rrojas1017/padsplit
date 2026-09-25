# BUG-005 corrective — repair race guard

One file only: `supabase/functions/submit-public-script/index.ts`. No other file, no other logic, same `responses` shape otherwise.

## Problem

A terminal row can be read by a concurrent request (network retry, or the loser of a 23505 insert race) while the original writer is still inside `finalizeSideEffects` (booking not inserted yet). That reader's `handleTerminal` finds no linked booking, runs the repair, and creates a duplicate booking + transcription + script_responses.

## Fix

Two surgical edits in the same file.

### 1. Stamp `_finalized_at` when a row becomes terminal

`buildEnriched` is the single chokepoint for every write (insert path, legacy path, in-progress update, atomic flip). Add `_finalized_at` only when the outcome is not `in_progress`.

Current (lines 295–305):

```ts
    const buildEnriched = (outcome: string): Record<string, unknown> => ({
      ...normalizedResponses,
      _probe_notes: probeNotes || {},
      _agent_notes: agentNotes || {},
      _early_disposition: outcome === 'ended_early' ? (earlyDisposition || 'ended_early') : null,
      _source: 'public_script',
      _token_id: tokenRow.id,
      _client_hash: clientHash,
      _submission_id: submissionId,
      _save_seq: saveSeq,
    });
```

New:

```ts
    const buildEnriched = (outcome: string): Record<string, unknown> => ({
      ...normalizedResponses,
      _probe_notes: probeNotes || {},
      _agent_notes: agentNotes || {},
      _early_disposition: outcome === 'ended_early' ? (earlyDisposition || 'ended_early') : null,
      _source: 'public_script',
      _token_id: tokenRow.id,
      _client_hash: clientHash,
      _submission_id: submissionId,
      _save_seq: saveSeq,
      ...(outcome !== 'in_progress' ? { _finalized_at: new Date().toISOString() } : {}),
    });
```

This covers all three terminal-write paths, because each routes through `buildEnriched`:
- Legacy path (line 505): `insertRow(terminalOutcome)` → terminal → stamped.
- New-submission terminal insert (line 548–553): `insertRow(terminalOutcome)` → stamped.
- Atomic flip (line 607–612): `updateFields(terminalOutcome)` → `buildEnriched(terminalOutcome)` → stamped.
- `in_progress` insert/update keep `outcome === 'in_progress'` → no stamp (as intended).

### 2. Gate the repair in `handleTerminal`

Current (lines 525–540):

```ts
    const handleTerminal = async (row: any): Promise<Response> => {
      const stored = (row.responses && typeof row.responses === 'object') ? row.responses : {};
      const storedAnswers = buildRawScriptAnswers(questions as any[], stored);
      const count = Object.keys(storedAnswers).length;
      let bookingId = await findLinkedBooking(row.id);
      if (!bookingId && qualifiesForBooking(row.call_outcome, count)) {
        bookingId = await finalizeSideEffects(row.id, row.call_outcome, storedAnswers, {
          repair: true,
          callerName: row.caller_name && row.caller_name !== 'Public Submission' ? row.caller_name : null,
          duration: typeof row.call_duration_seconds === 'number' ? row.call_duration_seconds : null,
          disposition: typeof stored._early_disposition === 'string' ? stored._early_disposition : null,
          lang: row.language || 'en',
        });
      }
      return ok(row.id, row.call_outcome, bookingId, count);
    };
```

New:

```ts
    const handleTerminal = async (row: any): Promise<Response> => {
      const stored = (row.responses && typeof row.responses === 'object') ? row.responses : {};
      const storedAnswers = buildRawScriptAnswers(questions as any[], stored);
      const count = Object.keys(storedAnswers).length;
      let bookingId = await findLinkedBooking(row.id);
      const finalizedAt = typeof stored._finalized_at === 'string' ? stored._finalized_at : null;
      const finalizedMs = finalizedAt ? new Date(finalizedAt).getTime() : null;
      const allowRepair = finalizedMs === null || Date.now() - finalizedMs > 120_000;
      if (!bookingId && qualifiesForBooking(row.call_outcome, count) && allowRepair) {
        bookingId = await finalizeSideEffects(row.id, row.call_outcome, storedAnswers, {
          repair: true,
          callerName: row.caller_name && row.caller_name !== 'Public Submission' ? row.caller_name : null,
          duration: typeof row.call_duration_seconds === 'number' ? row.call_duration_seconds : null,
          disposition: typeof stored._early_disposition === 'string' ? stored._early_disposition : null,
          lang: row.language || 'en',
        });
      }
      return ok(row.id, row.call_outcome, bookingId, count);
    };
```

Behavior:
- Row has no `_finalized_at` (old rows, or a row that somehow became terminal before this fix) → repair allowed, exactly as today. Backwards compatible.
- Row has `_finalized_at` younger than 120 s → repair skipped; return `ok` with the current `bookingId` (possibly `null`). No write of any kind.
- Row has `_finalized_at` older than 120 s → repair allowed (genuine stuck recovery, e.g. the original writer crashed mid-`finalizeSideEffects`).

The 120 s window comfortably exceeds the time `finalizeSideEffects` takes (a handful of inserts/updates), so a retry that lands while the original is still finalizing is suppressed, but a real orphan is still recovered.

## What does not change

- No other file.
- No change to `finalizeSideEffects`, `findLinkedBooking`, `rateLimit`, `insertRow`, the insert/flip/update branches, `qualifiesForBooking`, or the legacy path.
- `responses` shape is identical except for the added `_finalized_at` field on terminal writes; the `buildRawScriptAnswers` reader ignores unknown `_`-prefixed keys, so stats/answers are unaffected.
- No database change, no migration, no RLS, no `_shared/auth.ts`, no new audit action names, no new dependencies, nothing published.

## Acceptance

- A concurrent retry within 120 s of finalization returns `ok` with the existing booking id (or `null` if not yet linked) and performs no insert/update.
- A retry after 120 s still repairs (orphan recovery).
- An old-style request without `final`/`save_seq` stamps `_finalized_at` on the terminal insert and behaves as today.
- `deno check supabase/functions/submit-public-script/index.ts` clean.
