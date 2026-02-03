

# Plan: Enhance check-deepgram-plan with Usage Breakdown

## Overview
Enhance the existing `check-deepgram-plan` edge function to:
1. Use an explicit `DEEPGRAM_PROJECT_ID` secret (bypassing permission issues)
2. Fetch usage breakdown data (hours processed, request counts) for the current month
3. Calculate estimated costs based on actual usage

## Changes Required

### Step 1: Add New Secret
| Secret Name | Description |
|------------|-------------|
| `DEEPGRAM_PROJECT_ID` | Your Deepgram project ID for direct API access |

### Step 2: Update Edge Function

**File:** `supabase/functions/check-deepgram-plan/index.ts`

**New Capabilities:**
- Accept optional `DEEPGRAM_PROJECT_ID` from environment (falls back to auto-discovery if not set)
- Call `GET /v1/projects/{project_id}/usage/breakdown` with current month date range
- Return usage metrics:
  - `hours` - Total audio hours transcribed
  - `requests` - Number of API requests
  - `estimated_cost` - Calculated from hours × $0.0043/min

**Updated Response Structure:**
```json
{
  "success": true,
  "projects": [...],
  "usage": {
    "period": { "start": "2026-02-01", "end": "2026-02-03" },
    "total_hours": 15.5,
    "total_requests": 245,
    "estimated_cost_usd": 4.00,
    "breakdown_by_model": [...]
  },
  "summary": {
    "total_credits": 0,
    "credit_units": "USD"
  },
  "pricing_note": "..."
}
```

**Error Handling:**
- If usage endpoint returns 403, include partial data with note about permission limitations
- If project ID is invalid, provide clear error message

## Technical Details

### API Call for Usage
```javascript
const now = new Date();
const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
const today = now.toISOString().split('T')[0];

const usageResponse = await fetch(
  `https://api.deepgram.com/v1/projects/${projectId}/usage/breakdown?start=${startOfMonth}&end=${today}&grouping=models`,
  { headers: { 'Authorization': `Token ${apiKey}` } }
);
```

### Cost Calculation
```javascript
// Deepgram Nova-2 pricing: $0.0043/minute = $0.258/hour
const estimatedCost = totalHours * 0.258;
```

## Implementation Order
1. Request `DEEPGRAM_PROJECT_ID` secret from user
2. Update edge function with usage breakdown logic
3. Deploy and test the enhanced function

