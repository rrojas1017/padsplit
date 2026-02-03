

# Plan: Add Billing Breakdown to check-deepgram-plan

## Overview
Enhance the `check-deepgram-plan` edge function to fetch **actual billing data in USD** from Deepgram's Billing Breakdown API, providing accurate cost figures instead of estimates.

## Current vs. Proposed

| Metric | Current | Proposed |
|--------|---------|----------|
| Cost Source | Estimated (hours × $0.258) | Actual USD from Deepgram API |
| Granularity | Total only | Breakdown by line_item (model/feature) |
| Accuracy | Approximate | Exact billing data |

## Technical Changes

### File: `supabase/functions/check-deepgram-plan/index.ts`

**New Interface:**
```typescript
interface BillingBreakdownResult {
  dollars: number;
  grouping?: {
    start?: string;
    end?: string;
    line_item?: string;
    deployment?: string;
  };
}

interface BillingBreakdownResponse {
  start: string;
  end: string;
  resolution: { units: string; amount: number };
  results: BillingBreakdownResult[];
}
```

**New API Call:**
```typescript
const billingResponse = await fetch(
  `https://api.deepgram.com/v1/projects/${projectId}/billing/breakdown?start=${startOfMonth}&end=${today}&grouping=line_item`,
  { headers: { 'Authorization': `Token ${DEEPGRAM_API_KEY}` } }
);
```

**Updated Response Structure:**
```json
{
  "success": true,
  "usage": {
    "total_hours": 15.5,
    "total_requests": 245,
    "estimated_cost_usd": 4.00
  },
  "billing": {
    "period": { "start": "2026-02-01", "end": "2026-02-03" },
    "total_cost_usd": 3.87,
    "breakdown_by_line_item": [
      { "line_item": "streaming::nova-3", "dollars": 2.15 },
      { "line_item": "async::nova-2", "dollars": 1.72 }
    ]
  },
  "pricing_note": "This month: 15.5 hours processed ($3.87 actual)."
}
```

## Implementation Details

1. **Add billing fetch** after usage breakdown fetch
2. **Sum total dollars** from all billing results
3. **Group by line_item** to show cost per model/feature
4. **Prioritize actual billing** over estimated cost in `pricing_note`
5. **Handle 403 gracefully** - fall back to estimated cost if billing endpoint lacks permissions

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Billing API returns 403 | Use estimated cost, set `billing_error` |
| Billing API returns data | Show actual `$X.XX` in pricing note |
| Both APIs fail | Show message with available information |

## Updated Pricing Note Logic
```typescript
if (billing) {
  pricingNote += ` This month: ${usage.total_hours.toFixed(3)} hours ($${billing.total_cost_usd.toFixed(2)} actual).`;
} else if (usage) {
  pricingNote += ` This month: ${usage.total_hours.toFixed(3)} hours (~$${usage.estimated_cost_usd.toFixed(2)} estimated).`;
}
```

