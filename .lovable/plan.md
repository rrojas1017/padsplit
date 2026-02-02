

# Add Email Verification Badges (APILayer)

## Overview

Add automatic email verification when bookings are created using APILayer's Email Verification API. Results are stored in the database and displayed as verification badges in the UI. WhatsApp verification will be added later.

---

## API Integration Details

### APILayer Email Verification

| Property | Value |
|----------|-------|
| Endpoint | `GET https://api.apilayer.com/email_verification/{email}` |
| Auth | Header: `apikey: YOUR_API_KEY` |
| Valid Condition | `smtp_check = true` and `format_valid = true` |

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

---

## Required Secret

| Secret Name | Purpose | Where to get it |
|-------------|---------|-----------------|
| `APILAYER_API_KEY` | Email verification | https://apilayer.com → Email Verification API |

---

## Database Changes

Add email verification columns to the `bookings` table:

| Column | Type | Description |
|--------|------|-------------|
| `email_verified` | boolean | null = not checked, true = valid, false = invalid |
| `email_verified_at` | timestamptz | When verification was performed |
| `email_verification_status` | text | Detailed: valid, invalid, catch_all, disposable, unknown |

---

## Implementation Summary

### Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/verify-email/index.ts` | Edge function to call APILayer API |
| `src/components/reports/EmailVerificationBadge.tsx` | UI component for displaying email verification status |

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/AddBooking.tsx` | Trigger verification after booking creation |
| `src/components/reports/ContactProfileHoverCard.tsx` | Display verification badge next to email |
| `supabase/config.toml` | Add new function configuration |

---

## Edge Function: `verify-email`

**Input:**
```typescript
{
  bookingId: string;
  email: string;
}
```

**Flow:**
1. Validate input (bookingId and email required)
2. Call APILayer email verification API
3. Parse response to determine status
4. Update booking record with verification results
5. Return result

**Status Mapping:**
| APILayer Response | Our Status |
|-------------------|------------|
| `smtp_check = true` + `format_valid = true` | valid |
| `disposable = true` | disposable |
| `catch_all = true` | catch_all |
| `format_valid = false` | invalid |
| API error | unknown |

---

## Verification Badge Component

Visual indicators displayed next to email in the hover card:

| Status | Icon | Color | Tooltip |
|--------|------|-------|---------|
| valid | CheckCircle | Green | "Email verified" |
| invalid | XCircle | Red | "Invalid email" |
| disposable | AlertTriangle | Amber | "Disposable email" |
| catch_all | AlertCircle | Gray | "Catch-all domain" |
| unknown/null | None | - | No badge shown |

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
 │  invoke('verify-email', {...})       │
 │  (non-blocking, fires and forgets)   │
 └──────────────────────────────────────┘
        │
        ▼
   APILayer API
        │
        ▼
   Update bookings table
        │
        ▼
  HoverCard displays badge
  (on next data refresh)
```

---

## HoverCard UI Update

```text
Contact Details (Before):
┌─────────────────────────────────────────┐
│ ✉ john@example.com · 📞 (404) 555-1234  │
└─────────────────────────────────────────┘

Contact Details (After):
┌─────────────────────────────────────────────────────┐
│ ✉ john@example.com ✓ · 📞 (404) 555-1234            │
│                    ↑                                 │
│            Email verified                            │
└─────────────────────────────────────────────────────┘
```

---

## Execution Steps

1. Add the `APILAYER_API_KEY` secret
2. Create database migration for email verification columns
3. Create `supabase/functions/verify-email/index.ts` edge function
4. Create `src/components/reports/EmailVerificationBadge.tsx` component
5. Update `src/pages/AddBooking.tsx` to trigger verification after save
6. Update `src/components/reports/ContactProfileHoverCard.tsx` to display badge
7. Update `supabase/config.toml` with new function
8. Test the verification flow end-to-end

---

## Cost Estimation

| Service | Pricing | Monthly Est (500 bookings) |
|---------|---------|---------------------------|
| APILayer Email | 100 free/month, then ~$0.003/email | Free tier likely sufficient |

---

## Future Addition

WhatsApp verification via Maytapi can be added later as a separate enhancement, using:
- `MAYTAPI_PRODUCT_ID`
- `MAYTAPI_PHONE_ID`  
- `MAYTAPI_TOKEN`

The database schema and UI are designed to accommodate this future addition.

