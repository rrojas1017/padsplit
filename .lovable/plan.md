

# Fix: Research Insights Flash of Move-Out View on Navigation

## Problem
Every time you click "Research Insights" in the sidebar, the page navigates to `/research/insights` without any `campaign` parameter. This defaults to `move_out_survey` (line 63-64), which renders instantly from cached data. If you were previously viewing a different campaign type, you see the move-out view flash before you manually switch back.

## Solution
Persist the last-selected campaign type in `localStorage`. When the page loads without a `campaign` URL param, use the persisted value instead of always defaulting to `move_out_survey`.

## Change

| File | Change |
|------|--------|
| `src/pages/research/ResearchInsights.tsx` | Read last campaign from `localStorage` as fallback default; save to `localStorage` in `handleCampaignTypeChange` |

Specifically:
```typescript
// Line 63-65 — initialize from URL param → localStorage → fallback
const [campaignType, setCampaignType] = useState<CampaignType>(
  (searchParams.get('campaign') as CampaignType) 
  || (localStorage.getItem('research_insights_campaign') as CampaignType) 
  || 'move_out_survey'
);

// In handleCampaignTypeChange — persist selection
const handleCampaignTypeChange = (value: string) => {
  setCampaignType(value as CampaignType);
  localStorage.setItem('research_insights_campaign', value);
  setSearchParams({ tab: currentTab, campaign: value }, { replace: true });
};
```

This way the page remembers your last selection and renders it immediately — no flash of the move-out view.

