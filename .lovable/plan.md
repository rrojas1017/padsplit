# Fix API Costs Constraint & Improve Fire-and-Forget Error Handling

## Status: ✅ COMPLETED

---

## What Was Done

### Part 1: Database Migration ✅
- Added 'deepseek' to the `api_costs_service_provider_check` constraint
- Created `failed_downstream_calls` tracking table with indexes
- RLS enabled with service role access policy

### Part 2: Fire-and-Forget Error Handling ✅
Updated `supabase/functions/transcribe-call/index.ts` with:
- New `callDownstreamFunction` helper with:
  - Retry logic (2 retries with exponential backoff)
  - Full error context logging
  - Failed call tracking in `failed_downstream_calls` table
  - Network error handling
- Refactored Jeff coaching, QA scoring, and Katty coaching calls to use the new helper

---

## Expected Outcome

1. ✅ DeepSeek API costs will be logged successfully
2. ✅ Failed downstream calls will be retried automatically (2 retries with backoff)
3. ✅ Persistent failures will be visible in `failed_downstream_calls` table
4. ✅ Console logs will show full error context for debugging

---

## Files Changed

| File | Change |
|------|--------|
| Migration | Added `deepseek` to `api_costs_service_provider_check` constraint |
| Migration | Created `failed_downstream_calls` tracking table |
| `supabase/functions/transcribe-call/index.ts` | Added `callDownstreamFunction` helper with retry + logging |
