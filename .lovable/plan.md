# P9 — Coaching audio players use signed URLs (frontend step 1 toward private bucket)

## Goal
The coaching-audio Storage bucket is currently public, so every Jeff/Katty coaching MP3 is world-readable by URL. The DB columns `booking_transcriptions.coaching_audio_url` and `qa_coaching_audio_url` store full **public** URLs, and the `generate-coaching-audio` / `generate-qa-coaching-audio` edge functions also return public URLs (via `.getPublicUrl()`). This step makes the two audio players stop feeding the stored/returned URL straight into `<audio src>`, and instead mint a 1-hour **signed URL** through `supabase.storage.from('coaching-audio').createSignedUrl`.

This must work BOTH with the current public bucket AND after the bucket is made private, and must accept stored values that are a full public URL, a signed URL, or a bare object path. No edge-function, SQL, RLS, migration, bucket, or other-UI changes.

## File 1 (NEW): `src/utils/coachingAudio.ts`

```ts
import { supabase } from '@/integrations/supabase/client';

/**
 * Resolve a stored coaching-audio value into a 1-hour signed URL.
 * Accepts any of:
 *   - full public URL:  .../storage/v1/object/public/coaching-audio/<file>.mp3
 *   - full signed URL:  .../storage/v1/object/sign/coaching-audio/<file>.mp3?token=...
 *   - bare object path: coaching-audio/<file>.mp3  OR  <file>.mp3
 * Returns null for empty input or on failure (logs a short message without tokens).
 */
export async function resolveCoachingAudioSrc(
  stored: string | null | undefined,
): Promise<string | null> {
  if (!stored) return null;

  let path = stored;
  const pubMarker = '/object/public/coaching-audio/';
  const signMarker = '/object/sign/coaching-audio/';

  if (path.includes(pubMarker)) {
    path = path.split(pubMarker)[1] ?? '';
  } else if (path.includes(signMarker)) {
    path = path.split(signMarker)[1] ?? '';
  } else if (path.startsWith('coaching-audio/')) {
    path = path.slice('coaching-audio/'.length);
  }
  // strip any query string (signed-URL token) — createSignedUrl issues a fresh one
  path = path.split('?')[0];

  if (!path) return null;

  try {
    const { data, error } = await supabase.storage
      .from('coaching-audio')
      .createSignedUrl(path, 3600);

    if (error || !data?.signedUrl) {
      console.error('coachingAudio: failed to create signed URL', error?.message ?? 'no url');
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.error('coachingAudio: signed-url error', err instanceof Error ? err.message : err);
    return null;
  }
}
```

## File 2: `src/components/coaching/CoachingAudioPlayer.tsx`

Jeff coaching. `currentAudioUrl` stays the source of truth for existence checks / quiz gating / listened logic. A new `resolvedSrc` state feeds `<audio src>`.

- **Import** (after line 4): `import { resolveCoachingAudioSrc } from '@/utils/coachingAudio';`
- **State** (after line 45 `currentAudioUrl` state):
  ```ts
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  ```
- **Resolve effect** (after the existing `useEffect` that syncs `currentAudioUrl`, ~line 60):
  ```ts
  useEffect(() => {
    let cancelled = false;
    setResolvedSrc(null);
    resolveCoachingAudioSrc(currentAudioUrl).then((url) => {
      if (!cancelled) setResolvedSrc(url);
    });
    return () => { cancelled = true; };
  }, [currentAudioUrl]);
  ```
- **`<audio>` src** (line 301): change `src={currentAudioUrl}` → `src={resolvedSrc ?? undefined}`.

No change to: `handleGenerateAudio` (still calls `setCurrentAudioUrl(data.audioUrl)` — the effect resolves it), `handleEnded`, quiz/listened logic, blocked/paused states, variants.

## File 3: `src/components/qa/QACoachingAudioPlayer.tsx`

Katty QA coaching. Same pattern.

- **Import** (after line 5): `import { resolveCoachingAudioSrc } from '@/utils/coachingAudio';`
- **State** (after line 47 `currentAudioUrl` state):
  ```ts
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  ```
- **Resolve effect** (after the existing `useEffect` syncing `currentAudioUrl`/listened/quiz, ~line 59):
  ```ts
  useEffect(() => {
    let cancelled = false;
    setResolvedSrc(null);
    resolveCoachingAudioSrc(currentAudioUrl).then((url) => {
      if (!cancelled) setResolvedSrc(url);
    });
    return () => { cancelled = true; };
  }, [currentAudioUrl]);
  ```
- **`<audio>` src**:
  - Button variant (line 194): `src={currentAudioUrl || ''}` → `src={resolvedSrc || ''}`
  - Card variant (line 313): `src={currentAudioUrl}` → `src={resolvedSrc ?? undefined}`

No change to: `handleGenerateAudio` (still `setCurrentAudioUrl(data.audioUrl)` — effect resolves), `markAsListened`, quiz/listened logic, blocked states.

## What is NOT changed
- Edge functions (generate-coaching-audio / generate-qa-coaching-audio still return public URLs — resolved client-side).
- `config.toml`, SQL, RLS, migrations, the `coaching-audio` bucket or its policies.
- Callers of the two players (`MyPerformance`, `CoachingHub`, `QADashboard`, `MyQA`, `CallInsights`) — they still pass stored DB URLs.
- Components that only check existence of an audio URL (banners, engagement/report hooks) — untouched.

## Verification (no auth needed from here, but the bucket is still public)
- `tsgo`/typecheck the three files.
- Manual reasoning: with bucket public, `createSignedUrl` returns a working signed URL (same object). After bucket is made private, signed URL still works for any signed-in role thanks to the existing SELECT policy. A stored public URL, stored signed URL, or bare path all resolve to the same object path.
- Not testable from here without a signed-in session: actually loading an MP3 in the preview after this change. Stays a manual check for the user.
