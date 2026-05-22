## What's happening

Nothing is being deleted. The Payment Experience insights hook is hitting Supabase's **default 1,000-row cap** with no pagination. There are now **3,259** payment_experience records with extractions (and climbing as the backfill runs), but only the first 1,000 come back. As the backfill writes `research_extraction` into more rows, the *which* 1,000 rows are returned keeps shifting — so the visible "responses" counts on every question swing up and down even though the underlying database only grows.

DB truth right now:
- 4,596 payment_experience transcriptions
- 3,259 with `research_extraction` populated
- 176 known dues_day answers (147 weekday + 29 weekend), still growing

## The fix

Paginate the fetch in `src/hooks/usePaymentExperienceResponses.ts` so it loads all matching rows, not just the first 1,000. The project already has a `fetchAllPages` utility used elsewhere for exactly this.

### Technical detail

- File: `src/hooks/usePaymentExperienceResponses.ts` (the `useQuery` at line ~465)
- Replace the single `.select(...)` call with a paginated loop via `src/utils/fetchAllPages.ts` (1,000-row pages, ordered by `id` for stable paging).
- Keep the same columns, the same `.eq('research_campaign_type', 'payment_experience')` and `.not('research_extraction', 'is', null)` filters, and the same downstream mapping. No schema or UI changes.
- After the fix, response counts will only ever go **up** as the backfill completes; the 84 → 66 swing will stop.

No backend changes, no edge function changes, no UI changes — purely a data-fetching fix on one hook.