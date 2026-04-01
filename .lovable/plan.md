

## Add Campaign Slug (`campaign_key`) to Research Campaigns

### Problem
The `campaign` field in API submissions (`conversation_submissions.campaign`) is a free-text string (e.g. `"Q1-Research-2026"`) with no formal link to `research_campaigns`. The campaign name is parsed from booking notes via regex to find the script — fragile and error-prone.

### Solution
Add a `campaign_key` column to `research_campaigns` that auto-generates a dash-separated slug from the campaign name at creation time (e.g. `"January NPS Check"` → `"January-NPS-Check"`). This key becomes the value used in API `campaign` field, and the system matches on it instead of free-text.

### Changes

| # | What | Detail |
|---|---|---|
| 1 | **DB migration** | Add `campaign_key TEXT UNIQUE` column to `research_campaigns`. Backfill existing rows by converting `name` to dash-separated slug. |
| 2 | **Hook** `useResearchCampaigns.ts` | Auto-generate `campaign_key` from name during `createCampaign`. Include `campaign_key` in the interface and insert. On update, regenerate if name changes. |
| 3 | **Dialog** `ResearchCampaignDialog.tsx` | Show a read-only preview of the generated `campaign_key` below the name field so users see what will be used in the API. |
| 4 | **Campaign cards** `CampaignManager.tsx` | Display `campaign: "{c.campaign_key}"` instead of `c.name` in the copyable field. Add `campaign_id: {truncated UUID}` on a second line. |
| 5 | **Edge function** `submit-conversation-audio` | After inserting the booking, look up `research_campaigns` by `campaign_key` matching the `campaign` body param. If found, set `research_call_id` or link to the campaign for downstream processing. Store the `campaign_key` match in `conversation_submissions`. |
| 6 | **Edge function** `transcribe-call` | Replace the fragile regex-from-notes campaign lookup with a direct `campaign_key` lookup from `conversation_submissions.campaign` → `research_campaigns.campaign_key`. |

### Slug generation logic
```text
"Q1 Research 2026"  → "Q1-Research-2026"
"January NPS Check" → "January-NPS-Check"
```
Simple: `name.trim().replace(/\s+/g, '-')` — preserves casing, replaces spaces with dashes.

### Technical notes
- `campaign_key` has a UNIQUE constraint to prevent collisions
- Existing `conversation_submissions` records with `campaign = 'Q1-Research-2026'` will match after backfill since the existing campaign name likely already follows this pattern
- The campaign card will show both `campaign: "Q1-Research-2026"` (for API use) and `campaign_id: 12fd2184...` (for internal reference)

