

# Add Contact Verification Badges (Email & WhatsApp)

## Overview

Add automatic verification of email addresses and WhatsApp numbers when bookings are created. Uses APILayer for email validation and Maytapi for WhatsApp number checking. Results are stored in the database and displayed as verification badges in the UI.

---

## API Integration Details

### APILayer Email Verification

| Property | Value |
|----------|-------|
| Endpoint | `GET https://api.apilayer.com/email_verification/{email}` |
| Auth | Header: `apikey: YOUR_API_KEY` |
| Key Status | Valid (deliverable mailbox) |
| Invalid Statuses | invalid, disposable, spamtrap, abuse |

**Response Example:**
```json
{
  "email": "test@example.com",
  "format_valid": true,
  "mx_found": true,
  "smtp_check": true,
  "catch_all": false,
  "role": false,
  "disposable": false,
  "score": 0.96
}
```

### Maytapi WhatsApp Check

| Property | Value |
|----------|-------|
| Endpoint | `GET https://api.maytapi.com/api/{product_id}/{phone_id}/checkNumberStatus` |
| Auth | Query param: `token={api_token}` |
| Number Format | `{phone}@c.us` |

**Response Example:**
```json
{
  "success": true,
  "result": {
    "id": { "user": "1234567890" },
    "status": 200,
    "isBusiness": false,
    "canReceiveMessage": true
  }
}
```

---

## Required Secrets

| Secret Name | Purpose | Status |
|-------------|---------|--------|
| `APILAYER_API_KEY` | Email verification via APILayer | **Needs to be added** |
| `MAYTAPI_PRODUCT_ID` | Maytapi WhatsApp product ID | **Needs to be added** |
| `MAYTAPI_PHONE_ID` | Maytapi phone instance ID | **Needs to be added** |
| `MAYTAPI_TOKEN` | Maytapi API authentication | **Needs to be added** |

---

## Database Changes

Add verification columns to the `bookings` table:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `email_verified` | boolean | null | null = not checked, true = valid, false = invalid |
| `email_verified_at` | timestamptz | null | When verification was performed |
| `email_verification_status` | text | null | Detailed: valid, invalid, catch_all, disposable, unknown |
| `whatsapp_verified` | boolean | null | null = not checked, true = on WhatsApp, false = not on WhatsApp |
| `whatsapp_verified_at` | timestamptz | null | When verification was performed |
| `whatsapp_is_business` | boolean | null | Whether the WhatsApp account is a business account |

---

## Implementation Summary

### Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/verify-contact/index.ts` | Edge function to call both verification APIs |
| `src/components/reports/VerificationBadge.tsx` | UI component for displaying verification status |

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/AddBooking.tsx` | Trigger verification after booking creation |
| `src/components/reports/ContactProfileHoverCard.tsx` | Display verification badges next to email/phone |
| `supabase/config.toml` | Add new function configuration |

---

## Edge Function: `verify-contact`

The function handles both email and WhatsApp verification in parallel:

**Input:**
```typescript
{
  bookingId: string;
  email?: string;
  phone?: string;
}
```

**Flow:**
1. Validate input (at least one of email/phone required)
2. Call APILayer email verification (if email provided)
3. Call Maytapi WhatsApp check (if phone provided)
4. Update booking record with verification results
5. Return combined results

**Error Handling:**
- API failures don't fail the whole request
- Each verification is logged individually
- Graceful degradation (partial results OK)

---

## Verification Badge Component

Visual indicators displayed in the hover card:

| State | Icon | Color | Label |
|-------|------|-------|-------|
| Email verified | ✓ | Green | "Verified" |
| Email invalid | ✗ | Red | "Invalid" |
| Email disposable | ⚠ | Amber | "Disposable" |
| Not checked | - | Gray | No badge |
| WhatsApp active | 📱 | Green | "WhatsApp" |
| WhatsApp business | 💼 | Blue | "WhatsApp Business" |
| Not on WhatsApp | - | Gray | No badge |

---

## Integration Flow

```text
User Creates Booking
        │
        ▼
  Booking Saved
        │
        ▼
 ┌──────────────────────────────────────┐
 │  invoke('verify-contact', {...})     │
 │  (non-blocking, fires and forgets)   │
 └──────────────────────────────────────┘
        │
        ├───────────────┬───────────────┐
        ▼               ▼               │
   APILayer         Maytapi             │
   Email Check      WhatsApp Check      │
        │               │               │
        └───────┬───────┘               │
                ▼                       │
         Update bookings table          │
                                        │
        ┌───────────────────────────────┘
        ▼
  HoverCard displays badges
  (on next data refresh)
```

---

## HoverCard UI Update

The contact details section will show verification badges:

```text
Contact Details (Before):
┌─────────────────────────────────────────┐
│ ✉ john@example.com · 📞 (404) 555-1234  │
└─────────────────────────────────────────┘

Contact Details (After):
┌─────────────────────────────────────────────────────┐
│ ✉ john@example.com ✓    · 📞 (404) 555-1234 📱      │
│                    ↑                          ↑      │
│            Email verified           On WhatsApp      │
└─────────────────────────────────────────────────────┘
```

---

## Execution Steps

1. Add the required secrets:
   - `APILAYER_API_KEY` - from https://apilayer.com → Email Verification API
   - `MAYTAPI_PRODUCT_ID`, `MAYTAPI_PHONE_ID`, `MAYTAPI_TOKEN` - from https://maytapi.com dashboard

2. Create database migration to add verification columns to bookings

3. Create `supabase/functions/verify-contact/index.ts` edge function

4. Create `src/components/reports/VerificationBadge.tsx` component

5. Update `src/pages/AddBooking.tsx` to trigger verification after save

6. Update `src/components/reports/ContactProfileHoverCard.tsx` to display badges

7. Update `supabase/config.toml` with new function

8. Test the verification flow end-to-end

---

## Cost Estimation

| Service | Pricing | Monthly Est (500 bookings) |
|---------|---------|---------------------------|
| APILayer Email | 100 free/month, then ~$0.003/email | Free tier likely sufficient |
| Maytapi | $24/mo Developer plan | $24/month |

**Note:** Verification only runs on new bookings, not historical data. Batch verification for existing records can be added later if needed.

