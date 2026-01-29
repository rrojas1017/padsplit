
# Fix ElevenLabs Plan Check Function

## Problem Summary
The `check-elevenlabs-plan` edge function returns 401 because it calls the `/v1/user` endpoint, which isn't accessible with Workspace/Service Account API keys. Your key DOES work - the ElevenLabs logs show successful 200 responses to `/v1/voices` and `/v1/service-accounts`.

## Solution
Update the `check-elevenlabs-plan` function to use an endpoint that's compatible with workspace/service account keys, such as `/v1/voices` or `/v1/user/subscription`.

## Implementation Steps

### Step 1: Update the Edge Function
Modify `supabase/functions/check-elevenlabs-plan/index.ts` to:
1. Try the `/v1/user` endpoint first (for personal keys)
2. If that fails with 401, fall back to `/v1/voices` or `/v1/user/subscription` endpoint
3. Return useful information about the account status either way

```text
┌─────────────────────────────────────────────────────────────┐
│                    check-elevenlabs-plan                    │
├─────────────────────────────────────────────────────────────┤
│  1. Try /v1/user endpoint                                   │
│     └── Success? Return full subscription info              │
│     └── 401 Error? Continue to fallback...                  │
│                                                             │
│  2. Fallback: Try /v1/voices endpoint                       │
│     └── Success? Key is valid (workspace key)               │
│     └── Return basic confirmation + note about key type     │
│                                                             │
│  3. Both fail? Report actual error                          │
└─────────────────────────────────────────────────────────────┘
```

### Step 2: Code Changes
File: `supabase/functions/check-elevenlabs-plan/index.ts`

- Add a fallback request to `/v1/voices` when `/v1/user` returns 401
- Return a clear message indicating whether it's a personal key or workspace key
- Still return success=true if the key works for any endpoint

---

## Technical Details

### Why This Works
- Workspace API keys and service account keys can access most ElevenLabs endpoints EXCEPT `/v1/user`
- The `/v1/voices` endpoint is accessible with any valid key type
- Your TTS and STT functionality will work regardless of key type

### Files Modified
| File | Change |
|------|--------|
| `supabase/functions/check-elevenlabs-plan/index.ts` | Add fallback endpoint logic |

### Expected Outcome
After this change:
- ✅ Diagnostic check will pass and confirm key validity
- ✅ Will identify if using workspace vs personal key
- ✅ TTS/STT functionality continues to work as expected
