

# Fix: APILayer Email Verification Endpoint

## Problem Identified

The current implementation passes the email in the URL path, but according to the APILayer documentation, the email should be passed as a **query parameter**.

**Current (incorrect):**
```
GET https://api.apilayer.com/email_verification/test@example.com
```

**Correct (per documentation):**
```
GET https://api.apilayer.com/email_verification?email=test@example.com
```

---

## Fix Required

### File: `supabase/functions/verify-email/index.ts`

**Change line 61-62 from:**
```typescript
const apiResponse = await fetch(
  `https://api.apilayer.com/email_verification/${encodeURIComponent(email)}`,
```

**To:**
```typescript
const apiResponse = await fetch(
  `https://api.apilayer.com/email_verification?email=${encodeURIComponent(email)}`,
```

---

## Testing After Fix

1. Deploy the updated edge function
2. Run a test verification on an existing booking
3. Verify the API returns proper results (valid/invalid/disposable)
4. Check the booking record is updated correctly

---

## Execution Steps

1. Update the API endpoint URL in the edge function
2. Redeploy the `verify-email` function
3. Test with a real booking record to confirm it works

