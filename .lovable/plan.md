

# Enable Communication Permission for Your Account

## Problem
The email, SMS, and Voice buttons in the Contact Profile Hover Card are disabled because the `can_send_communications` flag on your profile is set to `false`.

## Solution
Update your profile in the database to enable communication permissions.

## Implementation

### Database Update

Run a migration to set `can_send_communications = true` for your user account:

```sql
UPDATE profiles 
SET can_send_communications = true 
WHERE id = 'ab22cc8a-e813-4f34-8883-b0fd1a076a1e';
```

This targets only your account (Roberto Rojas) and enables the email feature.

---

## Expected Result After Fix

| Before | After |
|--------|-------|
| Email button: Disabled | Email button: **Enabled** |
| SMS button: Disabled | SMS button: **Enabled** |
| Voice button: Disabled | Voice button: **Enabled** |

Once approved, you'll be able to click the Email button on any contact in the Reports page hover card to open the SendEmailDialog and send follow-up emails via SendGrid.

---

## Files to Modify

| File | Changes |
|------|---------|
| Database migration | Update `can_send_communications` for your profile |

