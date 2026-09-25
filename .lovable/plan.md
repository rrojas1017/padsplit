# CR-009 — Restore `recording_id` as the screen-pop link key (frontend text only)

**Scope:** 2 files, text/constants only — `src/pages/research/ScriptBuilder.tsx`, `src/pages/ApiDocs.tsx`. **CR-008 is dropped; do not implement it.** No edge function change (the backend already supports `recordingId`/`uid`), no `PublicScriptView.tsx`, no database, no `types.ts`, no new dependencies, nothing published.

## Why

PadSplit's IT manager confirmed ViciDial creates the `recording_id` when the pop opens (agent takes the call), so `--A--recording_id--B--` is valid at pop time. The screen-pop therefore carries `uid=--A--recording_id--B--` as the primary link key:

- A form that sends `dialer_uid` stores it in `dialer_call_id` (adopt path with phone cross-check).
- A recording that sends `recordingId` finds that same row in the id step → `linked: 'uid'` (phone cross-check).
- Lead + agent + time, then phone + agent, remain the fallbacks.

Backend behavior is unchanged — this ticket only aligns the docs and the generated screen-pop URL.

## Changes

### 1. `src/pages/research/ScriptBuilder.tsx`

**Line 37** — add `uid` first:

```ts
const SCREEN_POP_QUERY = '?uid=--A--recording_id--B--&lead=--A--lead_id--B--&phone=--A--phone_number--B--&agent=--A--user--B--&campaign=--A--campaign--B--';
```

**Line 225** — help line:

```tsx
<p className="text-xs text-muted-foreground">In the recording POST send the same recording_id as <code className="font-mono">recordingId</code> and the lead_id as <code className="font-mono">leadId</code>.</p>
```

(`SCREEN_POP_QUERY` is used on lines 220 and 222 unchanged; both now render with the leading `uid` param automatically.)

### 2. `src/pages/ApiDocs.tsx` — submit-conversation-audio section

**Lines 122–124** — parameter descriptions:

```tsx
{ name: 'leadId', type: 'string', required: false, description: 'ViciDial lead_id, max 64 chars. Fallback link key (lead + agent + call time).' },
{ name: 'recordingId', type: 'string', required: false, description: 'ViciDial recording_id, max 64 chars. Primary link key to the screen-pop form (the pop sends it as `uid`) and duplicate-protection key.' },
{ name: 'uniqueid', type: 'string', required: false, description: 'Legacy alias of recordingId. If both are sent, recordingId wins.' },
```

(`uniqueid` unchanged.)

**Lines 178–189** — Form + Recording Linking block, rewritten:

```tsx
<p className="text-sm text-muted-foreground mb-3 max-w-2xl leading-relaxed">
  When the agent's screen-pop form and the recording share the same call, both are stored as <strong className="text-foreground">one record</strong>:
  typed answers plus the recording and transcript. The recording is matched to the form first by{' '}
  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">recordingId</code>, then by{' '}
  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">leadId</code> + agent around the call time, then by phone + agent.
  A different phone number never links, and ambiguous matches are not linked. A repeat post of the same{' '}
  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">recordingId</code> returns 200 with{' '}
  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">duplicate: true</code> and writes nothing.
</p>
<p className="text-sm text-muted-foreground mb-3 max-w-2xl">
  Success responses include <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">linked</code>:{' '}
  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">"uid"</code> (matched by recording id),{' '}
  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">"lead"</code> (matched by lead + agent),{' '}
  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">"fallback"</code> (matched by phone + agent) or{' '}
  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">null</code> (new record).
</p>
```

**Line 191** — screen-pop URL example (add `uid` first):

```tsx
<CodeBlock language="text">{`<public script link>?uid=--A--recording_id--B--&lead=--A--lead_id--B--&phone=--A--phone_number--B--&agent=--A--user--B--&campaign=--A--campaign--B--`}</CodeBlock>
```

The 201 response example (lines 147–157) omits `linked`; leaving it as-is is fine. No other part of the file changes.

## Verification (after approval)

1. `tsgo --noEmit -p tsconfig.app.json` — clean.
2. Nothing published.
