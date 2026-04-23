/**
 * Generic paginator for Supabase queries to bypass PostgREST's default 1000-row limit.
 *
 * Usage:
 *   const rows = await fetchAllPages((from, to) =>
 *     supabase.from('booking_transcriptions')
 *       .select('id, booking_id, research_classification')
 *       .eq('research_campaign_type', 'move_out_survey')
 *       .range(from, to)
 *   );
 *
 * The builder MUST call .range(from, to) — fetchAllPages passes those values in.
 * Fetches in 1000-row chunks until the response is short or the ceiling is hit.
 */

const PAGE_SIZE = 1000;
const MAX_ROWS = 10_000;

export async function fetchAllPages<T = any>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  while (from < MAX_ROWS) {
    const to = Math.min(from + PAGE_SIZE - 1, MAX_ROWS - 1);
    const { data, error } = await buildQuery(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}
