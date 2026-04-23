

# Fix: Move-Out Survey Export Truncation

## Root Cause

Three paths for Move-Out research records silently cap rows, causing partial exports/drill-downs:

| Location | Current cap | Records eligible | Symptom |
|---|---|---|---|
| `useExportMembers` (Insights export modal) | PostgREST default **1000** | 841 today, growing | Will truncate as soon as we cross 1000 |
| `MemberDataTab` (Member Data tab table) | PostgREST default **1000** | 841 | Same — silent truncation looming |
| `ReasonCodeChart` reason drill-down | Hard-coded `.limit(500)` then client-filtered → effectively shows only matches in the first 500 fetched | 841 (~263 in the largest cluster) | **This is what the user sees: "first 50 contacts" of a single reason-code drill-down** |
| `ReasonCodeChart` addressability drill-down | Hard-coded `.limit(200)` | 841 | Same |

PostgREST returns max 1000 rows per request unless you paginate with `.range()`. Hard-coded `.limit(N)` then client-side filtering is the worst case — only the newest N records are even considered.

## Solution

Add a small reusable `fetchAllPages` helper and apply it everywhere we read Move-Out records for export/drill-down. No more silent caps.

### File changes

**1. New helper `src/utils/fetchAllPages.ts`**
- Generic paginator: takes a function `(from, to) => PostgrestQuery` and loops `.range()` calls in 1000-row chunks until exhausted or a hard ceiling (10,000 rows) is hit.
- Returns combined array.

**2. `src/hooks/useExportMembers.ts`**
- Replace each `await supabase.from(...).select(...)...` with `fetchAllPages(...)`.
- All four filter paths (`booking_ids`, `human_review`, `full_report`, `keywords`/`reason_code`) become fully paginated.
- No behavior change for filtering — still client-side after fetch.

**3. `src/components/research-insights/MemberDataTab.tsx`**
- Wrap the join + fallback queries in `fetchAllPages`.
- Member Data table will now show all 841 (and grow correctly).

**4. `src/components/research-insights/ReasonCodeChart.tsx`**
- Remove `.limit(500)` (line 212) and `.limit(200)` (line 661); use `fetchAllPages` instead.
- Reason-code drill-down and addressability drill-down will see the full population, not just the most recent slice.

### Validation

After deploy, on the Move-Out Insights page:
- Export modal → "Export Members" should report **841** records (up from ≤1000-capped count).
- Member Data tab → table count badge shows **841**.
- Click any reason cluster → drill-down list now shows the full member list (e.g., 263 instead of ~50) with working pagination.

### Out of scope

- `HumanReviewQueue` keeps its `.limit(50)` (it's an intentional triage queue, not an export).
- Audience Survey path is untouched (already working per the user).

