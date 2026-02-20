
# Moved-In Notification Settings — Super Admin UI

## What This Adds

A new card in **Settings → Security tab** (super admins only) that lets super admins:

1. **View the current recipient email** — shows a masked/readable version of the currently configured notification address
2. **Update the recipient email** — an input field + save button that updates the `MOVED_IN_NOTIFICATION_EMAIL` backend secret via an edge function
3. **Send a test notification** — a "Send Test" button that calls `notify-moved-in` with any recent booking ID so the super admin can confirm the email is arriving correctly

---

## Why Security Tab (Not a New Tab)

The Security tab already exists and is already restricted to `super_admin` / `admin` roles. This feature naturally fits there as it's a system-level notification configuration. However, since updating a backend secret requires super_admin-only access (not just admin), the card will be further guarded with `hasRole(['super_admin'])`.

---

## Architecture

### 1. New Edge Function: `manage-notification-settings`

Since backend secrets can't be read back by the frontend (they're encrypted), we need a different approach. The email address will be stored in a **new database table** `notification_settings` (not a secret) so it can be read and updated through the UI. The backend function will read from this table at send time instead of from `MOVED_IN_NOTIFICATION_EMAIL`.

Wait — reconsidering. The secret `MOVED_IN_NOTIFICATION_EMAIL` is already created and working. The cleanest approach is:

- **Store the email in a new `notification_settings` table** (one-row config table, super-admin only RLS)
- The edge function reads from this table instead of the secret
- The UI reads from and writes to this table directly
- Test button calls the edge function with a real recent booking ID

This avoids creating more edge functions and gives the UI full read/write access.

### 2. New Database Table: `notification_settings`

```sql
CREATE TABLE public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the moved_in_notification_email row
INSERT INTO public.notification_settings (key, value)
VALUES ('moved_in_notification_email', '');

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- Only super admins can read or write
CREATE POLICY "Super admins can manage notification settings"
ON public.notification_settings
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
```

### 3. Update `notify-moved-in` Edge Function

Change the function to read the recipient email from `notification_settings` table instead of `MOVED_IN_NOTIFICATION_EMAIL` secret. This makes the email configurable from the UI without touching secrets.

```typescript
// Instead of:
const recipientEmail = Deno.env.get('MOVED_IN_NOTIFICATION_EMAIL')!;

// Use:
const { data: setting } = await supabase
  .from('notification_settings')
  .select('value')
  .eq('key', 'moved_in_notification_email')
  .single();
const recipientEmail = setting?.value;
```

### 4. New Component: `MovedInNotificationSettings`

A self-contained card component added to the Security tab, only rendered when `hasRole(['super_admin'])`:

- Fetches current email from `notification_settings`
- Editable input field pre-filled with the current value
- **Save** button: UPDATEs the row in `notification_settings`
- **Send Test Email** button: fetches the most recent booking, then calls `supabase.functions.invoke('notify-moved-in', { body: { bookingId } })` directly, so the super admin gets a live test email
- Shows success/error toasts for both actions

### 5. Settings Page Update

Add the new component inside the Security tab, wrapped in `hasRole(['super_admin'])` check (stricter than the existing `canAccessAIManagement` which includes admins).

---

## Files Changed

| File | Change |
|---|---|
| Database migration | New `notification_settings` table + seed row + RLS |
| `supabase/functions/notify-moved-in/index.ts` | Read email from DB table instead of secret |
| `src/components/billing/MovedInNotificationSettings.tsx` | New UI card component |
| `src/pages/Settings.tsx` | Add component to Security tab (super_admin only) |

---

## How Testing Works (for the super admin)

1. Navigate to **Settings → Security**
2. Scroll to the **Move-In Notifications** card
3. Confirm or update the recipient email address and hit **Save**
4. Click **Send Test Email** — the system fetches the most recent booking in the database and fires a real notification email to the configured address
5. Check your inbox — the email should arrive within seconds

---

## Access Control Summary

| Role | Can see the card | Can edit email | Can send test |
|---|---|---|---|
| super_admin | Yes | Yes | Yes |
| admin | No | No | No |
| supervisor | No | No | No |
| agent | No | No | No |

