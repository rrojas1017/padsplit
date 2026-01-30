

# Hide Contact Info from Agents in Reports Section

## Overview

Add privacy protection for contact information (email and phone) by masking portions with asterisks for agent-role users, while keeping the Email/SMS action buttons fully functional.

## What Changes

| Location | Current | For Agents |
|----------|---------|------------|
| Reports table - Email column | `jason@email.com` | `jas***@email.com` |
| Reports table - Phone column | `678-463-1178` | `678-***-1178` |
| Hover card - Contact display | Full email/phone shown | Masked display |
| Hover card - Email/SMS buttons | Work with full data | **Still work** (masked display only) |
| CSV Export | Full email/phone | Masked for agents |

## Masking Rules

| Data Type | Example | Masked Version |
|-----------|---------|----------------|
| Email | `jason.smith@gmail.com` | `jas***@gmail.com` |
| Email (short) | `jo@x.com` | `j***@x.com` |
| Phone | `678-463-1178` | `678-***-1178` |
| Phone (10 digits) | `6784631178` | `678-***-1178` |

## Who Sees What

| Role | Full Contact Info | Masked Contact Info |
|------|-------------------|---------------------|
| super_admin | ✅ | - |
| admin | ✅ | - |
| supervisor | ✅ | - |
| agent | - | ✅ |

---

## Technical Implementation

### 1. Create Masking Utility

**New file:** `src/utils/contactPrivacy.ts`

```typescript
// Mask email: show first 3 chars + *** + @ + domain
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  const visibleChars = Math.min(3, local.length - 1);
  return `${local.slice(0, visibleChars)}***@${domain}`;
}

// Mask phone: show first 3 digits + *** + last 4 digits
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    return `${digits.slice(0, 3)}-***-${digits.slice(-4)}`;
  }
  return '***-***-****';
}

// Check if user should see masked contact info
export function shouldMaskContactInfo(userRole: string): boolean {
  return userRole === 'agent';
}
```

### 2. Update Reports.tsx

**File:** `src/pages/Reports.tsx`

Import the utility and apply masking:

```typescript
import { maskEmail, maskPhone, shouldMaskContactInfo } from '@/utils/contactPrivacy';

// In the component:
const shouldMask = shouldMaskContactInfo(user?.role || 'agent');

// In table cells (lines 740-764):
// Email column - show masked version for agents
{booking.contactEmail ? (
  shouldMask ? (
    <span className="text-muted-foreground truncate max-w-[180px] block">
      {maskEmail(booking.contactEmail)}
    </span>
  ) : (
    <a href={`mailto:${booking.contactEmail}`} ...>
      {booking.contactEmail}
    </a>
  )
) : ...}

// Phone column - show masked version for agents
{booking.contactPhone ? (
  shouldMask ? (
    <span className="text-muted-foreground whitespace-nowrap">
      {maskPhone(booking.contactPhone)}
    </span>
  ) : (
    <a href={`tel:${booking.contactPhone}`} ...>
      {formatPhone(booking.contactPhone)}
    </a>
  )
) : ...}
```

**CSV Export (lines 236-283):**
Apply masking to exported data for agents.

### 3. Update ContactProfileHoverCard.tsx

**File:** `src/components/reports/ContactProfileHoverCard.tsx`

Add masking to the displayed contact info while keeping action buttons functional:

```typescript
// Add new prop
interface ContactProfileHoverCardProps {
  // ... existing props
  shouldMaskContact?: boolean; // New prop
}

// In the contact display section (lines 258-272):
{contactEmail && (
  <span className="flex items-center gap-1 truncate max-w-[140px]">
    <Mail className="h-3 w-3" />
    {shouldMaskContact ? maskEmail(contactEmail) : contactEmail}
  </span>
)}
{contactPhone && (
  <span className="flex items-center gap-1">
    <Phone className="h-3 w-3" />
    {shouldMaskContact ? maskPhone(contactPhone) : contactPhone}
  </span>
)}

// Action buttons remain unchanged - they use the real data internally
// handleEmailClick and handleSmsClick still work with full contactEmail/contactPhone
```

### 4. Pass Masking Flag from Reports.tsx

When rendering the hover card, pass the masking flag:

```typescript
<ContactProfileHoverCard
  memberName={booking.memberName}
  // ... other props
  contactEmail={booking.contactEmail || undefined}
  contactPhone={booking.contactPhone || undefined}
  shouldMaskContact={shouldMask}
>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/utils/contactPrivacy.ts` | **New file** - masking utilities |
| `src/pages/Reports.tsx` | Apply masking to table columns and CSV export |
| `src/components/reports/ContactProfileHoverCard.tsx` | Add `shouldMaskContact` prop and mask display |

---

## User Experience

### Agent View (Masked)

**Table columns:**
| Email | Phone |
|-------|-------|
| `jas***@email.com` | `678-***-1178` |

**Hover card:**
- Shows: `📧 jas***@email.com · 📱 678-***-1178`
- Email button: **Works** - opens `mailto:jason@email.com` (real email)
- SMS button: **Works** - opens `sms:6784631178` (real phone)

### Admin/Supervisor View (Full)

**Table columns:**
| Email | Phone |
|-------|-------|
| `jason@email.com` | `678-463-1178` |

Both are clickable links as before.

---

## Security Notes

- Masking is **display-only** - the underlying data is still sent to the client
- This is a privacy improvement, not a security boundary
- For true data protection, server-side filtering would be needed (RLS policies)
- Current approach balances privacy with agent workflow (buttons still work)

