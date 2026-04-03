

# Fix Processing Stats — Filter by Campaign Type

## Problem
The "records processed" banner shows **609 / 655** but Total Cases is **329**. This is because:

- **655** = ALL research records (move-out + audience survey combined) — the query doesn't filter by campaign type
- **609** = only move-out processed records — this query DOES filter by campaign type
- **46 pending** = 655 - 609 = wrong, includes audience survey records that aren't "pending" for move-out

The total count query is missing the `research_campaign_type` filter.

## Fix

### `src/hooks/useResearchInsightsData.ts` — Add campaign type filter to totalCount query

Update the `totalCount` query (lines 41-47) to also filter by `research_campaign_type`:

```typescript
const { count: totalCount } = await supabase
  .from('booking_transcriptions')
  .select('id, bookings!inner(record_type, has_valid_conversation)', { count: 'exact', head: true })
  .not('call_transcription', 'is', null)
  .neq('call_transcription', '')
  .eq('bookings.record_type', 'research')
  .eq('bookings.has_valid_conversation', true)
  .eq('research_campaign_type', campaignType);  // ADD THIS
```

After this fix, when viewing move-out survey:
- Total = only move-out transcribed records (e.g., ~609)
- Processed = 609
- Pending = 0 (or close to it)

The "Total Cases: 329" from the AI report is a subset (records that passed quality gates and were analyzed in the latest report), which will always be ≤ processed count. That's expected and no longer confusing because the denominator matches.

### Files
| File | Change |
|------|--------|
| `src/hooks/useResearchInsightsData.ts` | Add `.eq('research_campaign_type', campaignType)` to totalCount query |

