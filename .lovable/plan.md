

# Fix Reports: Campaign Type Filter Must Be Server-Side

## Problem
When you select "Research" + "Move-Out Survey", the Reports page shows only **13 records** instead of the actual **771** valid move-out survey records.

**Root cause:** The campaign type filter (`move_out_survey` / `audience_survey`) is applied **after** the database query returns results. The DB fetches 50 records per page from ALL research records, then JavaScript filters that page down to only matching campaign types. So you only see whatever happens to match on that one page — in this case, 13 out of 50.

The `totalCount` is also wrong because it's set to `filteredRecords.length` (the client-filtered count) instead of the true database count.

## Fix

### `src/hooks/useReportsData.ts`

**Move campaign type filter into the database query** by using the `!inner` join syntax on `booking_transcriptions`:

1. When `campaignTypeFilter` is set (not `'all'`), change the join from `booking_transcriptions (...)` to `booking_transcriptions!inner (...)` and add `.eq('booking_transcriptions.research_campaign_type', campaignTypeFilter)` to the query. This makes the DB filter by campaign type before pagination.

2. For audience survey, also add `.gte('booking_transcriptions.survey_progress->answered', 1)` at the DB level (or use a post-filter but fetch all matching records).

3. **Remove the post-fetch client-side filtering** block (lines 368-382) that currently does `filteredRecords.filter(r => r.researchCampaignType === ...)`. This is what causes the count mismatch.

4. Always use the server `count` for `totalCount` — no more `clientFiltered ? filteredRecords.length : count`.

**Implementation detail:** The `!inner` join syntax in Supabase means "only return parent rows where the joined child exists and matches." When `campaignTypeFilter !== 'all'`, the select changes to:
```typescript
const joinType = (filters.campaignTypeFilter && filters.campaignTypeFilter !== 'all') 
  ? 'booking_transcriptions!inner' 
  : 'booking_transcriptions';

// In the select string, use the joinType variable
// Then after building the query:
if (filters.campaignTypeFilter && filters.campaignTypeFilter !== 'all') {
  query = query.eq('booking_transcriptions.research_campaign_type', filters.campaignTypeFilter);
}
if (filters.campaignTypeFilter === 'audience_survey') {
  // Quality gate: only include records with >= 1 question answered
  query = query.gte('booking_transcriptions.survey_progress->>answered', '1');
}
```

### Files
| File | Change |
|------|--------|
| `src/hooks/useReportsData.ts` | Move campaign type + audience quality gate filters to DB query level; remove client-side post-filtering; always use server count |

