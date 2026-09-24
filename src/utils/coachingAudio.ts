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
