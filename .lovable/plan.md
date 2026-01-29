
# Phone Enrichment via Contact Export - Integrated into Historical Import

## Overview

Add a "Phone Enrichment" tab to the existing Historical Import page that allows uploading a contact export file (`.numbers`, `.csv`, `.xlsx`) to match existing records **by email** and update missing phone numbers.

This approach avoids adding a new sidebar item and keeps all import-related functionality in one place.

---

## User Flow

```text
Historical Import Page
        |
        v
    ┌───────────────────────────────────────────┐
    │  [HubSpot Import]   [Phone Enrichment]    │  <-- Tab selector
    └───────────────────────────────────────────┘
                          |
                          v
    ┌─────────────────────────────────────────────────────────┐
    │  Upload Contact Export                                  │
    │  (.numbers, .csv, .xlsx with Name, Email, Phone)        │
    └───────────────────────────────────────────────────────────┘
                          |
                          v
    ┌─────────────────────────────────────────────────────────┐
    │  Preview: 5,400 contacts loaded                         │
    │  Matching: 4,791 records can be enriched (by email)     │
    │                                                          │
    │  [Start Enrichment]                                      │
    └─────────────────────────────────────────────────────────┘
                          |
                          v
    ┌─────────────────────────────────────────────────────────┐
    │  Complete! 4,500 records updated with phone numbers     │
    │  291 records had no matching email in file              │
    └─────────────────────────────────────────────────────────┘
```

---

## Implementation

### File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/pages/HistoricalImport.tsx` | **Modify** | Wrap existing content in tabs, add Phone Enrichment tab |
| `src/utils/contactEnrichmentParser.ts` | **Create** | New parser for contact export files |

---

## Technical Details

### 1. Tab Structure (HistoricalImport.tsx)

Add Tabs component wrapping existing content:

```tsx
<Tabs defaultValue="hubspot" className="space-y-6">
  <TabsList>
    <TabsTrigger value="hubspot">
      <Upload className="w-4 h-4 mr-2" />
      HubSpot Import
    </TabsTrigger>
    <TabsTrigger value="phone-enrichment">
      <Phone className="w-4 h-4 mr-2" />
      Phone Enrichment
    </TabsTrigger>
  </TabsList>
  
  <TabsContent value="hubspot">
    {/* Existing import logic */}
  </TabsContent>
  
  <TabsContent value="phone-enrichment">
    {/* New phone enrichment UI */}
  </TabsContent>
</Tabs>
```

### 2. Contact Enrichment Parser

**File: `src/utils/contactEnrichmentParser.ts`**

Parses the contact export file and builds a lookup map:

```typescript
export interface ContactRecord {
  name: string;
  email: string;
  phone: string;
}

export interface ContactParseResult {
  contacts: ContactRecord[];
  totalRows: number;
  withPhone: number;
  withEmail: number;
}

// Build email -> phone lookup map
export function buildPhoneLookup(contacts: ContactRecord[]): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const contact of contacts) {
    if (contact.email && contact.phone) {
      lookup.set(contact.email.toLowerCase().trim(), contact.phone);
    }
  }
  return lookup;
}
```

### 3. Phone Enrichment Flow

The enrichment process:

1. **Upload file** - Parse contact export (Numbers/CSV/Excel)
2. **Build lookup** - Create email-to-phone map (deduped)
3. **Preview match** - Query database for records missing phone with matching email
4. **Execute enrichment** - Batch update records in groups of 50
5. **Show results** - Display updated count and unmatched records

```typescript
// Fetch bookings needing phone enrichment
const { data: bookings } = await supabase
  .from('bookings')
  .select('id, contact_email')
  .is('contact_phone', null)
  .not('contact_email', 'is', null);

// Match and update
let updated = 0;
for (const booking of bookings) {
  const phone = phoneLookup.get(booking.contact_email.toLowerCase());
  if (phone) {
    await supabase
      .from('bookings')
      .update({ contact_phone: phone })
      .eq('id', booking.id);
    updated++;
  }
}
```

### 4. Phone Number Normalization

The parser will normalize phone numbers:
- Strip markdown link formatting (e.g., `<email>` becomes `email`)
- Keep only digits from phone numbers
- Handle empty phone cells gracefully

---

## UI Components for Phone Enrichment Tab

### Upload State
- Drag-and-drop zone for file upload
- Accepts `.numbers`, `.csv`, `.xlsx`
- File name display after selection

### Preview State
- Number of contacts loaded from file
- Number of records in database needing phones
- Number of potential matches (by email)
- Sample preview table (first 5-10 contacts)

### Enriching State
- Progress bar with percentage
- Current batch indicator
- Cancel button

### Complete State
- Success message with count of updated records
- Count of unmatched records
- Button to "View in Reports"

---

## Design Consistency

Following the existing app design patterns:
- Use existing Card components with `shadow-card` styling
- Consistent icon usage (Phone from lucide-react)
- Progress component for enrichment progress
- Toast notifications for success/error states
- Same step indicator pattern as HubSpot import

---

## Supported File Formats

| Format | Parsing Method |
|--------|----------------|
| `.numbers` | Via document parser (already used in your upload) |
| `.csv` | Direct text parsing with column detection |
| `.xlsx` | Via xlsx library (already installed) |

---

## Summary

This approach:
- **No new sidebar item** - Integrated into existing Historical Import page
- **Tab-based navigation** - Clean separation between HubSpot Import and Phone Enrichment
- **Email-based matching** - Most reliable matching strategy (93% of records have email)
- **Batch processing** - Efficient updates in groups of 50
- **Progress tracking** - Real-time feedback during enrichment
- **Consistent UI** - Follows existing design patterns
