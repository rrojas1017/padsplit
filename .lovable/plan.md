
# Enhanced Contact Profile Hover Card with Communication Features

## Overview

Transform the Contact Profile Hover Card from a data-heavy display into a **readable, actionable summary** optimized for follow-up communications. Add SMS/Email action buttons with a permission system that requires admin approval and full audit logging.

## Current Issues

| Issue | Impact |
|-------|--------|
| Card shows too much raw data | Hard to quickly scan for follow-up context |
| No communication actions | Agents must copy/paste contact info manually |
| No contact history tracking | No visibility into prior outreach attempts |
| No permission control | Anyone could potentially spam contacts |

## Solution Components

### 1. Redesigned Hover Card UI

```text
┌─────────────────────────────────────────────────────────────┐
│ 👤 Jason Sorensen                      😊 Positive   🎯 HIGH │
│ ────────────────────────────────────────────────────────────│
│                                                             │
│ 📝 QUICK SUMMARY                                            │
│ "Member looking for a room at $149/week in Atlanta.        │
│ Ready to move Thursday. Prefers no moving fee. Vehicle     │
│ registered. Reviewed house rules - no major concerns."     │
│                                                             │
│ ────────────────────────────────────────────────────────────│
│ 💬 KEY FOLLOW-UP POINTS                                     │
│ • Room at $149/week, no moving fee                         │
│ • Thursday move-in date                                     │
│ • 3-month commitment                                        │
│                                                             │
│ ────────────────────────────────────────────────────────────│
│ 📧 jason@email.com  ·  📱 678-463-1178                      │
│                                                             │
│ ┌──────────────┐   ┌──────────────┐                        │
│ │  📧 Email    │   │  📱 SMS      │                        │
│ └──────────────┘   └──────────────┘                        │
│                                                             │
│ 📬 Last Contacted: Jan 15, 2026 via SMS                    │
└─────────────────────────────────────────────────────────────┘
```

### 2. Permission System for Communications

**New database column on `profiles` table:**

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `can_send_communications` | BOOLEAN | false | Whether user can send SMS/Email to contacts |

**Permission flow:**
1. User requests communication permission (future feature)
2. Admin/Super Admin approves via User Management
3. Approval logged in `access_logs` with action `communication_permission_grant`
4. User sees enabled SMS/Email buttons on hover cards

### 3. Contact Communication History

**New database table: `contact_communications`**

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| booking_id | UUID | FK to bookings |
| user_id | UUID | Who sent the communication |
| user_name | TEXT | Name snapshot for audit |
| communication_type | TEXT | 'sms' or 'email' |
| recipient_email | TEXT | Email address used (if email) |
| recipient_phone | TEXT | Phone used (if SMS) |
| message_preview | TEXT | First 100 chars of message |
| sent_at | TIMESTAMPTZ | When communication was sent |
| status | TEXT | 'sent', 'failed', 'delivered' |

### 4. Audit Logging

All permission grants and communications are logged:

| Action | Logged In | Details Captured |
|--------|-----------|------------------|
| `communication_permission_grant` | access_logs | Approver, target user |
| `communication_permission_revoke` | access_logs | Revoker, target user |
| `contact_sms_sent` | contact_communications | Sender, recipient, booking |
| `contact_email_sent` | contact_communications | Sender, recipient, booking |

---

## Files to Create/Modify

| File | Type | Purpose |
|------|------|---------|
| **Migration** | SQL | Add `can_send_communications` to profiles, create `contact_communications` table |
| `src/components/reports/ContactProfileHoverCard.tsx` | Modify | Redesign UI for readability, add SMS/Email buttons |
| `src/pages/UserManagement.tsx` | Modify | Add toggle for communication permission (admin only) |
| `src/hooks/useContactCommunications.ts` | Create | Fetch communication history for a contact |
| `supabase/functions/send-contact-sms/index.ts` | Create | Future SMS integration placeholder |
| `supabase/functions/send-contact-email/index.ts` | Create | Future Email integration placeholder |

---

## Implementation Phases

### Phase 1: UI Redesign (Immediate)
- Redesign hover card for readability
- Show summary paragraph prominently
- Condense key points into bullet format
- Display contact email/phone inline
- Add placeholder SMS/Email buttons (disabled until permission system)

### Phase 2: Permission System
- Add `can_send_communications` column to profiles
- Add permission toggle in User Management (admin/super_admin only)
- Log all permission changes to access_logs
- Check permission before showing enabled buttons

### Phase 3: Communication Tracking
- Create `contact_communications` table
- Track when contacts are emailed/SMS'd
- Display "Last Contacted" in hover card
- Show communication history in contact details

### Phase 4: Provider Integration (Future)
- Integrate with SMS provider (Twilio/similar)
- Integrate with Email provider (SendGrid/Resend)
- Edge functions to handle actual sending
- Delivery status tracking

---

## Technical Details

### Updated Hover Card Props

```typescript
interface ContactProfileHoverCardProps {
  memberName: string;
  callKeyPoints?: CallKeyPoints;
  callSummary?: string;            // Add direct summary field
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'unavailable';
  contactEmail?: string;           // Add contact info
  contactPhone?: string;           // Add contact info
  bookingId: string;               // For communication tracking
  children: React.ReactNode;
}
```

### Permission Check Hook

```typescript
// In useAuth or separate hook
const canSendCommunications = async () => {
  const { data } = await supabase
    .from('profiles')
    .select('can_send_communications')
    .eq('id', user.id)
    .single();
  return data?.can_send_communications ?? false;
};
```

### Database Migration

```sql
-- Add communication permission to profiles
ALTER TABLE public.profiles 
ADD COLUMN can_send_communications BOOLEAN NOT NULL DEFAULT false;

-- Create contact communications tracking table
CREATE TABLE public.contact_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  user_name TEXT NOT NULL,
  communication_type TEXT NOT NULL CHECK (communication_type IN ('sms', 'email')),
  recipient_email TEXT,
  recipient_phone TEXT,
  message_preview TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'delivered'))
);

-- Enable RLS
ALTER TABLE public.contact_communications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view communications they sent"
ON public.contact_communications FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all communications"
ON public.contact_communications FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authorized users can insert communications"
ON public.contact_communications FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND can_send_communications = true
  )
);
```

---

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Spam prevention | Only approved users can send |
| Audit trail | Every communication logged |
| Permission escalation | Only super_admin/admin can grant |
| Data leakage | Contact info only visible to authorized roles |

---

## User Experience Flow

```text
Admin Workflow:
1. Navigate to User Management
2. Find user who needs communication permission
3. Toggle "Can Send Communications" switch
4. System logs approval in access_logs
5. User now sees enabled SMS/Email buttons

Agent Workflow:
1. Hover over contact name in Reports
2. See readable summary + key points
3. If authorized: Click Email or SMS button
4. Opens compose modal (Phase 4) or mailto:/sms: link (Phase 1)
5. Communication logged to contact_communications
6. Hover card shows "Last Contacted" next time
```
