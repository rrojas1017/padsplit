

# Fix Communication Permission for Your Account

## Problem Identified

The previous database migration updated the wrong user profile ID. The SMS, Email, and Voice buttons remain disabled because:

| Profile | Email | can_send_communications |
|---------|-------|------------------------|
| `dabfed9b-e797-41a9-a8f9-68a571575138` (Your active account) | rrojas@vixicom.com | **false** |

The migration mistakenly targeted a different ID (`ab22cc8a-...`) that doesn't match your logged-in account.

---

## Solution

Run a corrected database migration to enable communication permissions for your actual profile:

```sql
UPDATE profiles 
SET can_send_communications = true 
WHERE id = 'dabfed9b-e797-41a9-a8f9-68a571575138';
```

---

## Expected Result After Fix

| Button | Before | After |
|--------|--------|-------|
| Email  | Disabled | **Enabled** |
| SMS    | Disabled | **Enabled** |
| Voice  | Disabled | **Enabled** |

---

## Technical Details

The `useContactCommunications` hook checks `can_send_communications` by querying:

```typescript
const { data } = await supabase
  .from('profiles')
  .select('can_send_communications')
  .eq('id', user.id)  // user.id = dabfed9b-e797-41a9-a8f9-68a571575138
  .single();
```

When this returns `false`, all communication buttons are disabled via the condition:

```typescript
disabled={!contactPhone || !canSendCommunications}
```

---

## Implementation

1. Execute database migration with correct profile ID
2. Refresh the Reports page to reload the permission check
3. Test SMS, Email, and Voice buttons in the Contact Profile Hover Card

