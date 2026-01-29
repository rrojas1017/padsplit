
# Re-Import HubSpot Data to Capture Contact Information

## Problem Identified

The existing 5,163 imported records have:
- **Empty `notes` field** - call summary/notes were not saved during original import  
- **Plain `member_name`** without embedded email - only the extracted name was saved, not the original "Name (email)" format

The backfill edge function can't extract data that doesn't exist in the database. The contact email and phone data is in the **source CSV file** but wasn't captured during the original imports.

## Solution

**Re-import the HubSpot CSV file** using the updated parser which now correctly captures:

| Data Point | Source in CSV | How It's Captured |
|------------|---------------|-------------------|
| **Email** | `Associated Contact`: "Keith Barnes (k7275062@gmail.com)" | Extracted from parentheses |
| **Phone** | `Call notes`: "call was made from +17702307471 to +19044103644" | Direction-aware extraction (TO for outbound, FROM for inbound) |

## What Changed in the Parser

The `toBookingInsert()` function now includes:
```typescript
contact_email: record.contactEmail || null,
contact_phone: record.contactPhone || null,
```

And the parser extracts:
- Email from "Name (email)" format in the Associated Contact column
- Phone from call notes using direction-aware logic

## Steps to Get Contact Data

1. **Delete the existing imported batch** (optional - use the batch ID to rollback)
2. **Re-upload the HubSpot CSV** on the Historical Import page
3. The updated parser will now capture email and phone for each record
4. Records will appear in Reports with Email and Phone columns populated

## Alternative: Update Existing Records Manually

If you don't want to re-import, you could:
1. Export the current records with their IDs
2. Match against the original CSV by Record ID or Recording URL
3. Run a SQL update to populate `contact_email` and `contact_phone`

But **re-importing is simpler** since the parser now handles everything automatically.

## Verification After Re-Import

The Reports page now has Email and Phone columns that will display:
- Clickable `mailto:` links for emails
- Clickable `tel:` links for formatted phone numbers
- CSV export includes both fields
