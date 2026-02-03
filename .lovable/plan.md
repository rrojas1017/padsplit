
# Plan: Create check-deepgram-plan Edge Function

## Overview
Create a new edge function that queries the Deepgram Management API to retrieve account information, project details, and credit balances - similar to the existing `check-elevenlabs-plan` function.

## API Discovery
The Deepgram Management API provides the following relevant endpoints:
- `GET /v1/projects` - List all projects (auto-discovers project ID)
- `GET /v1/projects/{project_id}/balances` - Get credit balances
- `GET /v1/projects/{project_id}` - Get project details

This means we **don't need a separate DEEPGRAM_PROJECT_ID secret** - we can discover projects automatically from the API key.

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/check-deepgram-plan/index.ts` | Create | New edge function to query Deepgram account info |
| `supabase/config.toml` | Modify | Add function configuration with `verify_jwt = true` |

## Technical Implementation

### Edge Function Logic
1. Validate `DEEPGRAM_API_KEY` exists in environment
2. Call `GET /v1/projects` to discover all projects
3. For each project, call `GET /v1/projects/{id}/balances` to get credit info
4. Return structured response with:
   - API key validity status
   - Project names and IDs
   - Credit balances (amount, units)
   - Pricing notes based on detected plan

### Response Structure
```json
{
  "success": true,
  "projects": [
    {
      "project_id": "...",
      "name": "...",
      "balances": [
        {
          "balance_id": "...",
          "amount": 100.00,
          "units": "USD"
        }
      ]
    }
  ],
  "pricing_note": "Current STT rate: $0.0043/min (Nova-2)"
}
```

### Error Handling
- Missing API key → Clear error message
- 401 Unauthorized → Invalid or expired API key
- 403 Forbidden → Key lacks management permissions
- Network errors → Graceful failure with details

## No New Secrets Required
The existing `DEEPGRAM_API_KEY` is sufficient - the function will auto-discover project IDs from the API.

## Testing
After deployment, the function can be invoked to verify:
- API key validity
- Account balance/credits remaining
- Project configuration
