

# Switch Email Verification Provider to EmailListVerify

## Overview

Replace the current APILayer email verification service with **EmailListVerify** for improved reliability. This change involves updating the Edge Function to use the new API endpoint and response format.

---

## API Comparison

| Feature | APILayer (Current) | EmailListVerify (New) |
|---------|-------------------|----------------------|
| Endpoint | `api.apilayer.com/email_verification/{email}` | `apps.emaillistverify.com/api/verifyEmail?secret=KEY&email=EMAIL` |
| Auth | Header: `apikey: KEY` | Query param: `secret=KEY` |
| Response | JSON object | Plain text status |

---

## EmailListVerify Response Codes

The API returns simple text responses:

| Response | Meaning | Our Status Mapping |
|----------|---------|-------------------|
| `ok` | Email passed all tests | `valid` (verified: true) |
| `failed` | Email failed verification | `invalid` (verified: false) |
| `unknown` | Cannot be accurately tested | `unknown` (verified: false) |
| `incorrect` | Syntax error or empty | `invalid` (verified: false) |
| `key_not_valid` | Invalid API key | Error handling |
| `missing parameters` | Request issue | Error handling |

---

## Changes Required

### 1. Add New Secret

A new secret `EMAILLISTVERIFY_API_KEY` needs to be added for the EmailListVerify API key.

### 2. Update Edge Function

**File:** `supabase/functions/verify-email/index.ts`

Changes:
- Update endpoint URL from APILayer to EmailListVerify
- Change authentication from header-based to query parameter
- Simplify response parsing (text instead of JSON)
- Map text responses to verification statuses

---

## Technical Details

### New API Call Format

```typescript
const apiResponse = await fetch(
  `https://apps.emaillistverify.com/api/verifyEmail?secret=${apiKey}&email=${encodeURIComponent(email)}`,
  { method: 'GET' }
);

const responseText = await apiResponse.text();
// responseText will be: "ok", "failed", "unknown", "incorrect", etc.
```

### Status Mapping Logic

```typescript
switch (responseText.trim().toLowerCase()) {
  case 'ok':
    return { verified: true, status: 'valid' };
  case 'failed':
    return { verified: false, status: 'invalid' };
  case 'unknown':
    return { verified: false, status: 'unknown' };
  case 'incorrect':
    return { verified: false, status: 'invalid' };
  default:
    return { verified: false, status: 'unknown' };
}
```

---

## Implementation Steps

1. **Add the EmailListVerify API key secret** - You'll be prompted to enter your API key
2. **Update the Edge Function** - Replace APILayer logic with EmailListVerify
3. **Deploy the updated function** - Automatic deployment
4. **Test verification** - Run test on existing bookings to confirm it works

---

## No UI Changes Required

The existing `EmailVerificationBadge` component and database schema remain unchanged. Only the backend verification provider is swapped.

