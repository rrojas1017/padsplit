

# Add Voice Notes Option & Mask Contact Info in Cards

## Overview

Add a "Voice Notes" button alongside the existing Email and SMS options in the Contact Profile Hover Card, and ensure contact information (email and phone) is properly masked for agent users in the card display.

## Changes Summary

| Area | Change |
|------|--------|
| Database | Add `'voice_note'` to the `communication_type` check constraint |
| TypeScript types | Extend `communicationType` to include `'voice_note'` |
| Hover card UI | Add new "Voice Notes" button with phone icon/mic styling |
| Voice action handler | Implement `handleVoiceNoteClick` to open `tel:` link and log the communication |
| Masking | Already implemented via `shouldMaskContact` prop - verify it's passed correctly |

---

## Implementation Details

### 1. Database Migration

Add `'voice_note'` to the allowed communication types:

```sql
-- Alter the check constraint to include voice_note
ALTER TABLE public.contact_communications 
DROP CONSTRAINT IF EXISTS contact_communications_communication_type_check;

ALTER TABLE public.contact_communications 
ADD CONSTRAINT contact_communications_communication_type_check 
CHECK (communication_type IN ('sms', 'email', 'voice_note'));
```

### 2. Update TypeScript Types

**File:** `src/hooks/useContactCommunications.ts`

Update the `communicationType` type to include `'voice_note'`:

```typescript
// Line 10 - Interface
communicationType: 'sms' | 'email' | 'voice_note';

// Line 25 - Function parameter
communicationType: 'sms' | 'email' | 'voice_note';

// Line 83 - Type cast
communicationType: row.communication_type as 'sms' | 'email' | 'voice_note',

// Line 104 - Function parameter
communicationType: 'sms' | 'email' | 'voice_note';

// Line 141 - Type cast  
communicationType: row.communication_type as 'sms' | 'email' | 'voice_note',
```

### 3. Add Voice Notes Button to Hover Card

**File:** `src/components/reports/ContactProfileHoverCard.tsx`

Add import for microphone/phone icon:

```typescript
import { ..., Mic } from 'lucide-react';
```

Add voice note handler (after `handleSmsClick`):

```typescript
const handleVoiceNoteClick = () => {
  if (contactPhone && bookingId) {
    const cleanPhone = contactPhone.replace(/\D/g, '');
    window.location.href = `tel:${cleanPhone}`;
    logCommunication({
      bookingId,
      communicationType: 'voice_note',
      recipientPhone: contactPhone,
    });
  }
};
```

Update the action buttons section (lines 278-300) to include Voice Notes:

```typescript
{/* Action Buttons */}
<div className="flex gap-2">
  <Button
    variant="outline"
    size="sm"
    className="flex-1 h-8 text-xs"
    onClick={handleEmailClick}
    disabled={!contactEmail || !canSendCommunications}
    title={!canSendCommunications ? 'Communication permission required' : 'Send Email'}
  >
    <Mail className="h-3.5 w-3.5 mr-1.5" />
    Email
  </Button>
  <Button
    variant="outline"
    size="sm"
    className="flex-1 h-8 text-xs"
    onClick={handleSmsClick}
    disabled={!contactPhone || !canSendCommunications}
    title={!canSendCommunications ? 'Communication permission required' : 'Send SMS'}
  >
    <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
    SMS
  </Button>
  <Button
    variant="outline"
    size="sm"
    className="flex-1 h-8 text-xs"
    onClick={handleVoiceNoteClick}
    disabled={!contactPhone || !canSendCommunications}
    title={!canSendCommunications ? 'Communication permission required' : 'Voice Note'}
  >
    <Mic className="h-3.5 w-3.5 mr-1.5" />
    Voice
  </Button>
</div>
```

### 4. Masking Status

The contact masking is **already implemented** via the `shouldMaskContact` prop:
- Lines 265 and 272 already conditionally apply `maskEmail()` and `maskPhone()` when `shouldMaskContact` is true
- This prop is passed from `Reports.tsx` based on the user's role

---

## UI Preview

### Contact Action Buttons (After)

```text
┌─────────────────────────────────────────────────────────┐
│  [📧 Email]    [💬 SMS]    [🎤 Voice]                   │
└─────────────────────────────────────────────────────────┘
```

### Agent View (Masked)

```text
📧 jas***@email.com · 📱 678-***-1178

[Email] [SMS] [Voice]

✓ Buttons still functional with real data
```

---

## Files to Modify

| File | Changes |
|------|---------|
| Database migration | Add `'voice_note'` to constraint |
| `src/hooks/useContactCommunications.ts` | Extend type to include `'voice_note'` |
| `src/components/reports/ContactProfileHoverCard.tsx` | Add `Mic` icon import, `handleVoiceNoteClick` handler, and Voice button |

---

## Communication Logging

When a user clicks "Voice", the system will:
1. Open the device's phone dialer via `tel:` protocol
2. Log the communication with `communicationType: 'voice_note'`
3. Display in "Last contacted" as "via VOICE_NOTE"

