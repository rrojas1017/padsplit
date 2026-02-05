
# Fix API Costs Constraint & Improve Fire-and-Forget Error Handling

## Overview

Two issues are causing silent failures in the transcription pipeline:
1. **Database constraint blocking DeepSeek cost logging** - the `api_costs_service_provider_check` constraint only allows `elevenlabs`, `lovable_ai`, and `deepgram`
2. **Fire-and-forget calls failing silently** - when downstream functions return 404 or error, only a console log is emitted with no retry or alerting

---

## Part 1: Database Migration

**Add 'deepseek' to the CHECK constraint:**

```sql
ALTER TABLE api_costs 
DROP CONSTRAINT IF EXISTS api_costs_service_provider_check;

ALTER TABLE api_costs 
ADD CONSTRAINT api_costs_service_provider_check 
CHECK (service_provider = ANY (ARRAY['elevenlabs', 'lovable_ai', 'deepgram', 'deepseek']));
```

---

## Part 2: Improve Fire-and-Forget Error Handling

### Current Pattern (Lines 1706-1762)

The current code uses basic `.then()/.catch()` for Jeff's coaching and an anonymous async IIFE for QA/Katty. Errors are only logged to console.

### Improved Pattern

Add a helper function that:
1. Logs failures with full context (booking ID, function name, status code, response body)
2. Stores failed attempts to a tracking table for later retry/visibility
3. Includes retry logic for transient failures (network issues, 5xx errors)

**New Helper Function:**

```typescript
async function callDownstreamFunction(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  functionName: string,
  bookingId: string,
  maxRetries: number = 2
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ bookingId }),
      });

      if (response.ok) {
        console.log(`[Downstream] ${functionName} succeeded for ${bookingId}`);
        return { success: true, statusCode: response.status };
      }

      const errorBody = await response.text();
      console.error(`[Downstream] ${functionName} failed (${response.status}): ${errorBody}`);

      // Don't retry on 4xx client errors (except 429 rate limit)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        // Log to failed_downstream_calls table for visibility
        await supabase.from('failed_downstream_calls').insert({
          booking_id: bookingId,
          function_name: functionName,
          status_code: response.status,
          error_message: errorBody.substring(0, 1000),
          attempt_count: attempt + 1,
        });
        return { success: false, statusCode: response.status, error: errorBody };
      }

      // Wait before retry on 5xx or 429
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s exponential backoff
        console.log(`[Downstream] Retrying ${functionName} in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    } catch (networkError) {
      console.error(`[Downstream] Network error calling ${functionName}:`, networkError);
      if (attempt === maxRetries) {
        return { success: false, error: String(networkError) };
      }
    }
  }
  return { success: false, error: 'Max retries exceeded' };
}
```

**Updated Pipeline Code:**

```typescript
// Jeff's coaching (only for Vixicom)
if (!skipTts) {
  callDownstreamFunction(supabase, supabaseUrl, supabaseServiceKey, 'generate-coaching-audio', bookingId)
    .then(result => {
      if (!result.success) {
        console.error(`[Background] Jeff coaching failed permanently for ${bookingId}`);
      }
    });
}

// QA scoring -> Katty coaching (chained)
(async () => {
  const qaResult = await callDownstreamFunction(
    supabase, supabaseUrl, supabaseServiceKey, 'generate-qa-scores', bookingId
  );
  
  if (qaResult.success && !skipTts) {
    await callDownstreamFunction(
      supabase, supabaseUrl, supabaseServiceKey, 'generate-qa-coaching-audio', bookingId
    );
  }
})();
```

---

## Part 3: Optional Tracking Table

Create a table to track failed downstream calls for debugging and manual retry:

```sql
CREATE TABLE IF NOT EXISTS failed_downstream_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  function_name text NOT NULL,
  status_code integer,
  error_message text,
  attempt_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX idx_failed_downstream_booking ON failed_downstream_calls(booking_id);
CREATE INDEX idx_failed_downstream_unresolved ON failed_downstream_calls(resolved_at) WHERE resolved_at IS NULL;
```

---

## Files Changed

| File | Change |
|------|--------|
| Migration | Add `deepseek` to `api_costs_service_provider_check` constraint |
| Migration | Create `failed_downstream_calls` tracking table |
| `supabase/functions/transcribe-call/index.ts` | Add `callDownstreamFunction` helper with retry + logging, refactor fire-and-forget calls |

---

## Expected Outcome

1. DeepSeek API costs will be logged successfully
2. Failed downstream calls will be retried automatically (2 retries with backoff)
3. Persistent failures will be visible in `failed_downstream_calls` table
4. Console logs will show full error context for debugging
