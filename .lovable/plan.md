

# Real-Time Email Validation During Booking Entry

## Overview

Add instant email verification as agents type in the email field when creating a new booking. The agent will immediately see whether the email is valid, invalid, or has issues before submitting the form.

---

## User Experience Flow

```text
Agent types email → Debounce 800ms → API verification → Show badge/status
       ↓                                                      ↓
   Green check (format ok)              ✓ Valid | ⚠ Disposable | ✕ Invalid
```

**Visual Feedback:**
- While typing: Green checkmark appears when format is valid (current behavior)
- After pause: Spinner shows "Verifying..." 
- Result: Badge appears showing verification status (valid/invalid/disposable/catch-all)

---

## Changes Required

### 1. Create New Edge Function: `verify-email-realtime`

A lightweight version of the verify-email function that:
- Does NOT require a bookingId (email-only verification)
- Returns the verification result directly
- Does NOT update any database records

**Endpoint:** `POST /verify-email-realtime`  
**Body:** `{ email: string }`  
**Response:** `{ verified: boolean, status: 'valid' | 'invalid' | 'disposable' | 'catch_all' | 'unknown' }`

### 2. Update AddBooking.tsx

Add real-time verification logic:
- **Debounced API call** - Wait 800ms after user stops typing to avoid excessive API calls
- **Loading state** - Show spinner while verifying
- **Result display** - Show the EmailVerificationBadge inline with the input
- **Warning logic** - If email is invalid/disposable, show amber warning message but allow submission

### 3. Optional Enhancement for EditBooking.tsx

Apply the same real-time validation to the edit form if contact_email field is present there.

---

## Technical Implementation

### New Edge Function Structure

```typescript
// supabase/functions/verify-email-realtime/index.ts
Deno.serve(async (req) => {
  const { email } = await req.json();
  
  // Call EmailListVerify API
  const response = await fetch(`https://apps.emaillistverify.com/api/verifyEmail?secret=${apiKey}&email=${email}`);
  
  // Return result without updating database
  return Response.json({ verified, status });
});
```

### Frontend Integration

```typescript
// In AddBooking.tsx
const [emailVerificationStatus, setEmailVerificationStatus] = useState<EmailVerificationStatus>(null);
const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);

// Debounced verification call
useEffect(() => {
  if (!isValidEmail(contactEmail)) {
    setEmailVerificationStatus(null);
    return;
  }
  
  const timer = setTimeout(async () => {
    setIsVerifyingEmail(true);
    const result = await supabase.functions.invoke('verify-email-realtime', { 
      body: { email: contactEmail } 
    });
    setEmailVerificationStatus(result.data?.status || null);
    setIsVerifyingEmail(false);
  }, 800);
  
  return () => clearTimeout(timer);
}, [contactEmail]);
```

### UI Updates

```jsx
{/* Email field with real-time verification */}
<div className="relative">
  <Input value={contactEmail} onChange={...} />
  
  {/* Show spinner while verifying */}
  {isVerifyingEmail && <Loader2 className="animate-spin ..." />}
  
  {/* Show verification badge when done */}
  {!isVerifyingEmail && emailVerificationStatus && (
    <EmailVerificationBadge status={emailVerificationStatus} />
  )}
</div>

{/* Warning message for problematic emails */}
{emailVerificationStatus === 'invalid' && (
  <p className="text-destructive text-xs">
    ⚠️ This email appears to be invalid. Please verify with the member.
  </p>
)}
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/verify-email-realtime/index.ts` | Create new |
| `src/pages/AddBooking.tsx` | Add verification logic + UI |
| `src/pages/EditBooking.tsx` | Add same verification (if email field exists) |

---

## Behavior Notes

- **Format check first**: The green checkmark for valid format still appears immediately
- **API verification second**: After 800ms pause, real verification runs
- **Non-blocking**: Invalid emails show a warning but don't block form submission (agent may have confirmed with member)
- **Error handling**: If API fails, status shows "unknown" with no error to user
- **Cost control**: 800ms debounce prevents excessive API calls

