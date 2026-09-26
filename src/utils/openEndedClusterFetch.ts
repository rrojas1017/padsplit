// Shared open-ended cluster helpers (cache lookup + on-demand clustering).
// Moved verbatim from generate-pe-docx.ts (CR-010 Phase 3); the log tag is a
// parameter whose default keeps PE's exact warning text.

import { supabase } from '@/integrations/supabase/client';

// ── Hash helper (matches usePEOpenEndedClusters) ─────────────────────────────

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Cluster cache lookup ────────────────────────────────────────────────────
//
// Reads cached AI clusters for a given open-ended question from
// `payment_experience_open_ended_cluster_cache`. Returns aggregate buckets
// only (label, count, %). Returns null if no cache hit.

export async function fetchClustersForQuestion(
  questionId: string,
  questionText: string,
  responses: string[],
  logTag = '[generate-pe-docx]',
): Promise<Array<{ label: string; count: number; pct: number }> | null> {
  if (responses.length < 8) return null; // matches MIN_RESPONSES_FOR_AI
  const total = responses.length;
  const shape = (raw: any): Array<{ label: string; count: number; pct: number }> | null => {
    if (!Array.isArray(raw)) return null;
    return raw
      .map((c: any) => ({
        label: c.label || 'Unlabeled',
        count: Array.isArray(c.responseIndices) ? c.responseIndices.length : 0,
      }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count)
      .map((c) => ({ ...c, pct: total > 0 ? (c.count / total) * 100 : 0 }));
  };

  try {
    const hash = await sha256Hex(JSON.stringify(responses));
    // 1) Cache lookup
    const { data } = await supabase
      .from('payment_experience_open_ended_cluster_cache')
      .select('clusters')
      .eq('question_id', questionId)
      .eq('response_hash', hash)
      .maybeSingle();
    if (data && (data as any).clusters) {
      const out = shape((data as any).clusters);
      if (out && out.length) return out;
    }

    // 2) Cache miss — invoke the cluster function on demand (90s soft timeout)
    const invokeP = supabase.functions.invoke('cluster-pe-open-ended', {
      body: { questionId, questionText, responses, responseHash: hash },
    });
    const timeoutP = new Promise<{ data: any; error: any }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 90_000),
    );
    const { data: fnData, error: fnError } = await Promise.race([invokeP, timeoutP]) as any;
    if (fnError || !fnData || fnData.ok !== true) {
      console.warn(`${logTag} cluster invoke failed for`, questionId, fnError);
      return null;
    }
    return shape(fnData.clusters);
  } catch (e) {
    console.warn(`${logTag} cluster lookup error for`, questionId, e);
    return null;
  }
}
