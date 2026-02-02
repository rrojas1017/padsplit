
# Integrate ClickSend for SMS Messaging

## Overview

Add in-app SMS messaging functionality using ClickSend API, following the exact patterns established by the email implementation. This replaces the native `sms:` link behavior with a dialog-based experience.

---

## Prerequisites

**ClickSend API Credentials Required**

You'll need to add two secrets before the implementation:

| Secret Name | Description |
|-------------|-------------|
| `CLICKSEND_USERNAME` | Your ClickSend account username |
| `CLICKSEND_API_KEY` | Your ClickSend API key |

Get these from: https://dashboard.clicksend.com → Settings → API Credentials

---

## Implementation Summary

### Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/send-follow-up-sms/index.ts` | Edge function to send SMS via ClickSend REST API |
| `src/components/reports/SendSMSDialog.tsx` | SMS composition dialog with templates |

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useContactCommunications.ts` | Add `sendSMS` method |
| `src/components/reports/ContactProfileHoverCard.tsx` | Replace native `sms:` with dialog trigger |
| `supabase/config.toml` | Add `send-follow-up-sms` function config |

---

## Technical Details

### 1. Edge Function: `send-follow-up-sms`

Following the same pattern as `send-follow-up-email`:

**Authentication Flow:**
1. Extract JWT from authorization header
2. Decode to get user ID
3. Check `can_send_communications` permission in profiles table
4. Return 403 if not permitted

**ClickSend API Integration:**
```text
POST https://rest.clicksend.com/v3/sms/send
Authorization: Basic base64(username:api_key)
Content-Type: application/json

Request Body:
{
  "messages": [{
    "to": "+1234567890",
    "from": "PadSplit",
    "body": "Message content here"
  }]
}

Success Response: HTTP 200 with status "SUCCESS"
Error Responses: INVALID_RECIPIENT, INSUFFICIENT_CREDIT, etc.
```

**Logging:**
- On success: Insert to `contact_communications` with status `sent`
- On failure: Insert with status `failed`

**Validation:**
- Phone number format (E.164 or standard US format)
- Message length (≤ 1600 characters for concatenated SMS)
- Required fields (bookingId, recipientPhone, message)

---

### 2. UI Component: `SendSMSDialog`

Modeled after `SendEmailDialog` with SMS-specific features:

**Template Selection:**

| Template | Trigger Condition | Example Message |
|----------|-------------------|-----------------|
| Quick Follow-Up | Default | "Hi {name}, checking in on your PadSplit interest in {market}. Questions? -{agent}" |
| Move-In Reminder | status = "Pending Move-In" | "Hi {name}, reminder about your move-in on {date}. Need anything? -{agent}" |
| Re-Engagement | status = "Non Booking" or "Postponed" | "Hi {name}, still looking in {market}? I can help find the right fit. -{agent}" |
| Custom | User selects | Pre-filled greeting + signature |

**SMS-Specific Features:**
- Character counter showing current/max (160 per segment)
- Segment indicator (1 SMS = 160 chars, 2 SMS = 306 chars, etc.)
- No preview toggle needed (text-only)
- Shorter, more direct templates than email

**Layout:**
- Recipient display (name + phone)
- Template selector dropdown
- Message textarea with character count
- Send button with loading state

---

### 3. Hook Update: `useContactCommunications`

Add new method:

```typescript
interface SendSMSParams {
  bookingId: string;
  recipientPhone: string;
  recipientName: string;
  message: string;
}

sendSMS: (params: SendSMSParams) => Promise<{ success: boolean; error?: string }>
```

Implementation invokes `supabase.functions.invoke('send-follow-up-sms', { body: params })` and handles response/errors.

---

### 4. HoverCard Update

Current SMS button behavior:
```typescript
window.location.href = `sms:${cleanPhone}`;
```

New behavior:
```typescript
setShowSMSDialog(true);
```

Add state and render `SendSMSDialog` component with required props.

---

### 5. Config Update

Add to `supabase/config.toml`:
```toml
[functions.send-follow-up-sms]
verify_jwt = false
```

---

## SMS Character Limits

| Segments | Characters (GSM-7) | Characters (Unicode) |
|----------|-------------------|---------------------|
| 1 | 160 | 70 |
| 2 | 306 | 134 |
| 3 | 459 | 201 |
| 4+ | 153 per segment | 67 per segment |

The dialog will show segment count to help agents stay within budget-friendly limits.

---

## Expected User Flow

1. User hovers over contact name in Reports
2. Hover card appears with SMS button
3. User clicks SMS button
4. SendSMSDialog opens with:
   - Auto-selected template based on booking status
   - Pre-filled message with member name, market, dates
5. User optionally edits message
6. Character counter updates in real-time
7. User clicks "Send SMS"
8. Edge function validates permission and sends via ClickSend
9. Success toast appears, dialog closes
10. Communication logged in `contact_communications` table
11. "Last Contacted" updates in hover card

---

## Next Steps After Approval

1. Prompt you to add ClickSend secrets (Username and API Key)
2. Create the Edge Function
3. Create the SendSMSDialog component
4. Update the hook with sendSMS method
5. Update ContactProfileHoverCard to use the dialog
6. Update config.toml
7. Test the SMS flow end-to-end
