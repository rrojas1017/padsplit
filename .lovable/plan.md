
# Secure SendGrid Email Integration for Follow-Up Emails

## Overview

Implement a secure email sending system using SendGrid that allows users to send follow-up emails to contacts directly from the Reports page and Contact Profile Hover Card. Emails will be sent via a backend Edge Function using your rotated SendGrid API key stored securely as a secret.

---

## Architecture

```text
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│   Reports Page /    │────▶│   Edge Function     │────▶│   SendGrid API  │
│   Hover Card        │     │   send-follow-up-   │     │   (SMTP/API)    │
│                     │     │   email             │     │                 │
└─────────────────────┘     └─────────────────────┘     └─────────────────┘
         │                           │
         │                           ▼
         │                  ┌─────────────────────┐
         │                  │  contact_           │
         └─────────────────▶│  communications     │
                            │  (audit log)        │
                            └─────────────────────┘
```

---

## Implementation Steps

### Step 1: Add SendGrid API Key as Secret

Securely store the SendGrid API key as a secret in your backend:

| Secret Name | Value | Purpose |
|-------------|-------|---------|
| `SENDGRID_API_KEY` | Your rotated key | Authenticate with SendGrid API |

---

### Step 2: Create Edge Function `send-follow-up-email`

New file: `supabase/functions/send-follow-up-email/index.ts`

**Features:**
- Accepts booking ID, recipient email, subject, and message body
- Uses SendGrid Web API (not SMTP) for better reliability
- Validates user has `can_send_communications` permission
- Logs communication to `contact_communications` table
- Sends from `noreply@padsplit.tools` with "PadSplit" sender name

**Email Template Options:**
1. **Quick Follow-Up** - Short personalized check-in
2. **Move-In Reminder** - Confirmation with key dates
3. **Re-Engagement** - For postponed/non-booking recovery

---

### Step 3: Create Email Compose Dialog Component

New file: `src/components/reports/SendEmailDialog.tsx`

**Features:**
- Modal dialog triggered from Reports page or Hover Card
- Template selector (Quick Follow-Up, Move-In Reminder, Re-Engagement)
- Auto-populated fields from booking data:
  - Member name
  - Move-in date (if applicable)
  - Market location
- Custom subject line and message body editing
- Preview before sending
- Loading state and success/error feedback

---

### Step 4: Update Contact Profile Hover Card

Modify: `src/components/reports/ContactProfileHoverCard.tsx`

**Changes:**
- Replace current `mailto:` link with dialog trigger
- Open SendEmailDialog with booking context pre-filled
- Keep fallback to `mailto:` if user doesn't have permission

---

### Step 5: Add Email Action to Reports Table

Modify: `src/pages/Reports.tsx`

**Changes:**
- Add email icon button in actions column (or dropdown menu)
- Opens SendEmailDialog for the selected record
- Disabled for records without email or without permission

---

## Database Considerations

The existing `contact_communications` table already tracks communications:

| Column | Type | Purpose |
|--------|------|---------|
| `communication_type` | text | Already supports 'email' |
| `recipient_email` | text | Already available |
| `message_preview` | text | Can store email subject |
| `status` | text | 'sent', 'failed', 'delivered' |

**Enhancement (optional):**
Add a `subject` column to store email subjects separately from preview, or use existing `message_preview` for subject line.

---

## Security Considerations

| Concern | Solution |
|---------|----------|
| API Key Exposure | Stored as Supabase secret, only accessible in Edge Function |
| Unauthorized Sending | Check `can_send_communications` permission before sending |
| Audit Trail | All emails logged to `contact_communications` table |
| Rate Limiting | SendGrid has built-in rate limits; consider UI debounce |
| Email Validation | Validate recipient email format before sending |

---

## Email Templates

### Template 1: Quick Follow-Up
```text
Subject: Following up on your PadSplit interest, {memberName}

Hi {memberName},

I wanted to check in following our recent conversation about PadSplit housing in {marketCity}. 

Do you have any questions I can help answer?

Best regards,
{agentName}
PadSplit Team
```

### Template 2: Move-In Reminder
```text
Subject: Your upcoming move-in on {moveInDate}

Hi {memberName},

Just a friendly reminder about your scheduled move-in on {moveInDate} in {marketCity}, {marketState}.

Please let us know if anything has changed or if you need any assistance preparing for your move.

Best regards,
{agentName}
PadSplit Team
```

### Template 3: Re-Engagement
```text
Subject: Still looking for housing, {memberName}?

Hi {memberName},

I noticed your search for housing in {marketCity} hasn't moved forward yet. 

I'd love to help you find the right fit. Would you like to schedule a quick call to discuss your options?

Best regards,
{agentName}
PadSplit Team
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/send-follow-up-email/index.ts` | Edge function for sending emails via SendGrid |
| `src/components/reports/SendEmailDialog.tsx` | Email compose dialog component |

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/config.toml` | Add function config for `send-follow-up-email` |
| `src/components/reports/ContactProfileHoverCard.tsx` | Replace mailto with dialog trigger |
| `src/pages/Reports.tsx` | Add email action button |
| `src/hooks/useContactCommunications.ts` | Add `sendEmail` function that calls edge function |

---

## User Flow

1. User clicks **Email** button on Reports row or Hover Card
2. **SendEmailDialog** opens with member info pre-filled
3. User selects template or writes custom message
4. User clicks **Send**
5. Edge function validates permission, sends via SendGrid
6. Communication logged to `contact_communications`
7. User sees success toast and dialog closes

---

## Technical Notes

- Uses SendGrid Web API v3 (`@sendgrid/mail` npm equivalent via fetch)
- Edge function validates JWT and checks user permission
- Sender configured as `noreply@padsplit.tools` (your verified domain)
- Template variables replaced server-side for consistency
