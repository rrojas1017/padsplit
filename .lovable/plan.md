
# Add Contact Email & Phone to Reports

## Overview

Extract and display contact email and phone from HubSpot import data. The phone number extraction logic will be direction-aware:
- **Outbound calls**: Capture the TO number (agent called the contact)
- **Inbound calls**: Capture the FROM number (contact called the agent)

---

## Implementation Steps

### Step 1: Database Migration

Add two new columns to the `bookings` table:

```sql
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS contact_email text,
ADD COLUMN IF NOT EXISTS contact_phone text;
```

---

### Step 2: Update HubSpot Parser

**File: `src/utils/hubspotCallParser.ts`**

Add direction-aware phone extraction:

```typescript
function extractPhoneFromNotes(notes: string, direction: string): string | null {
  if (!notes) return null;
  
  // Pattern: "call was made from +1XXXXXXXXXX to +1YYYYYYYYYY"
  const match = notes.match(/call was made from (\+?\d{10,14}) to (\+?\d{10,14})/i);
  if (!match) return null;
  
  const fromNumber = match[1];
  const toNumber = match[2];
  
  // Outbound: agent called TO the contact → return TO number
  // Inbound: contact called FROM their phone → return FROM number
  if (direction.toLowerCase().includes('outbound')) {
    return toNumber;
  } else {
    return fromNumber;
  }
}
```

Update `ParsedCallRecord` interface to include `contactPhone`.

Update parsing loop to extract phone with direction awareness.

Update `toBookingInsert()` to include both `contact_email` and `contact_phone`.

---

### Step 3: Backfill Edge Function

**New file: `supabase/functions/batch-enrich-contacts/index.ts`**

Process existing 5,163 imported records:
1. Query records with null contact_email or contact_phone
2. For each record:
   - Extract email from member_name if it contains email pattern
   - Extract phone from notes using direction-aware logic (check booking_type for Inbound/Outbound)
3. Update bookings table
4. 10-second pacing between batches

---

### Step 4: Update Types

**File: `src/types/index.ts`**

Add to Booking interface:
```typescript
contactEmail?: string | null;
contactPhone?: string | null;
```

---

### Step 5: Update Data Fetching

**File: `src/hooks/useReportsData.ts`**

Add `contact_email` and `contact_phone` to SELECT query and transform.

---

### Step 6: Update Reports Page

**File: `src/pages/Reports.tsx`**

Add Email and Phone columns to table (after Contact):
- Email: Clickable mailto link or "—"
- Phone: Formatted with tel link or "—"

Add phone formatting helper for display (XXX-XXX-XXXX format).

Update CSV export to include Contact Email and Contact Phone columns.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| Database migration | CREATE |
| `src/utils/hubspotCallParser.ts` | MODIFY |
| `supabase/functions/batch-enrich-contacts/index.ts` | CREATE |
| `src/types/index.ts` | MODIFY |
| `src/hooks/useReportsData.ts` | MODIFY |
| `src/pages/Reports.tsx` | MODIFY |

---

## Expected Result

```text
Record Date | Move-In | Contact      | Email                | Phone        | Agent | ...
Jan 23, 2026| —       | Keith Barnes | k7275062@gmail.com   | 463-280-7980 | Win   | ...
Jan 23, 2026| —       | Tina Ross    | polarbabe67@gmail.com| 702-468-9613 | Win   | ...
```
