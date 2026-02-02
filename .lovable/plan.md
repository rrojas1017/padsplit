
# Fix Agent Hover Cards + Add Granular Communication Permissions

## Problem Summary

Two issues were identified:

1. **Agents cannot see call insights in hover cards** - The `MyBookings` page uses `BookingsContext` which does NOT fetch `callKeyPoints` data from the `booking_transcriptions` table (this was moved out for performance optimization). However, this means agents always see "No contact insights" even for transcribed bookings.

2. **Communication permissions are all-or-nothing** - Currently, `can_send_communications` controls Email, SMS, AND Voice together. Admins need per-channel control.

---

## Solution Overview

### Fix 1: Agent Hover Cards Data Fetching

Change the `MyBookings` page to fetch transcription data directly (like the Reports page does) instead of relying on `BookingsContext`.

**Why this approach:**
- The `BookingsContext` intentionally omits heavy data for performance across all users
- Reports page already has a pattern (`useReportsData`) that joins `booking_transcriptions` 
- MyBookings is agent-specific with a smaller dataset, so joining transcription data is acceptable
- RLS policies already allow agents to view their own transcriptions

### Fix 2: Granular Communication Permissions

Add per-channel permission columns and update the User Management UI.

---

## Database Changes

Add three new permission columns:

```sql
ALTER TABLE profiles
ADD COLUMN can_send_email boolean NOT NULL DEFAULT false,
ADD COLUMN can_send_sms boolean NOT NULL DEFAULT false,
ADD COLUMN can_send_voice boolean NOT NULL DEFAULT false;

-- Migrate existing permissions to all channels
UPDATE profiles 
SET can_send_email = can_send_communications,
    can_send_sms = can_send_communications,
    can_send_voice = can_send_communications;

COMMENT ON COLUMN profiles.can_send_email IS 'Permission to send emails from contact hover cards';
COMMENT ON COLUMN profiles.can_send_sms IS 'Permission to send SMS from contact hover cards';
COMMENT ON COLUMN profiles.can_send_voice IS 'Permission to initiate voice calls from contact hover cards';
```

---

## Frontend Changes

### 1. MyBookings Page - Fetch Transcription Data

Create a custom data fetching approach for MyBookings that joins `booking_transcriptions`:

```typescript
// In MyBookings.tsx - replace BookingsContext usage with direct query
const { data: myBookingsData } = await supabase
  .from('bookings')
  .select(`
    id, member_name, booking_date, move_in_date, agent_id, status, ...,
    booking_transcriptions (
      call_key_points,
      call_summary
    )
  `)
  .eq('agent_id', myAgent.id)
  .gte('booking_date', dateLimit);
```

This ensures agents see the same insights as other roles in their hover cards.

### 2. useContactCommunications Hook Updates

Fetch and expose individual permission states:

```typescript
interface UseContactCommunicationsReturn {
  canSendCommunications: boolean;  // Master toggle
  canSendEmail: boolean;           // Email only
  canSendSMS: boolean;             // SMS only
  canSendVoice: boolean;           // Voice only
  // ... existing fields
}
```

Permission logic:
- Each channel is enabled if BOTH `can_send_communications` AND the specific channel flag are true
- This maintains backward compatibility (master toggle can disable all)

### 3. ContactProfileHoverCard Updates

Update button disabled states to use granular permissions:

```typescript
// Email button
disabled={!contactEmail || !canSendEmail}
title={!canSendEmail ? 'Email permission required' : 'Send Email'}

// SMS button  
disabled={!contactPhone || !canSendSMS}
title={!canSendSMS ? 'SMS permission required' : 'Send SMS'}

// Voice button
disabled={!contactPhone || !canSendVoice}
title={!canSendVoice ? 'Voice permission required' : 'Call'}
```

### 4. User Management UI

Replace the single "Communications" toggle with an expandable panel:

```text
Communications
+----------------------------------------------+
| [Master Toggle] Enable Outreach              |
|                                              |
| When enabled:                                |
|   [Email] [SMS] [Voice]                      |
+----------------------------------------------+
```

- Master toggle shows/hides individual channel toggles
- Individual toggles are checkboxes or small switches
- Changes are logged to audit log with specific channel names

---

## Files to Modify

| File | Changes |
|------|---------|
| Database Migration | Add `can_send_email`, `can_send_sms`, `can_send_voice` columns |
| `src/pages/MyBookings.tsx` | Replace BookingsContext with direct query that joins booking_transcriptions |
| `src/hooks/useContactCommunications.ts` | Fetch and expose granular permissions |
| `src/components/reports/ContactProfileHoverCard.tsx` | Use granular permission checks per button |
| `src/pages/UserManagement.tsx` | Replace single toggle with expandable permission UI |

---

## Technical Notes

### RLS Verification

The existing `booking_transcriptions` RLS policy `view_transcription` already allows agents to read their own transcriptions:

```sql
(get_my_role() = 'agent'::text) AND (booking_id IN (
  SELECT b.id FROM bookings b JOIN agents a ON (b.agent_id = a.id)
  WHERE a.user_id = auth.uid()
))
```

No RLS changes needed.

### Backward Compatibility

- Existing `can_send_communications` values are migrated to all three new columns
- Master toggle behavior is preserved
- Agents with no permissions stay disabled

### Audit Logging

Permission changes will be logged with specifics:
- `"Changed {user}'s can_send_email from false to true"`
- `"Changed {user}'s can_send_sms permission: enabled"`

---

## Expected Outcome

After implementation:
1. Agents will see full call insights (budget, timeline, concerns) in hover cards on MyBookings page
2. Admins can enable/disable Email, SMS, and Voice separately per agent
3. Agents see disabled state with tooltip for channels they don't have permission for
4. All permission changes are logged to audit
