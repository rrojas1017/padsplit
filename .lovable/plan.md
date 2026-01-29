

# Fix Phone Number Import from HubSpot Call Notes

## Problem

Phone numbers aren't being imported because the parser can't find the call notes column. The current code looks for columns named "call summary" or "summary":

```typescript
callSummary: headers.findIndex(h => h.includes('call summary') || h.includes('summary')),
```

But HubSpot exports use "Call and meeting notes" as the column name, so it returns -1 (not found), and no notes are captured.

Since the phone number extraction relies on parsing text from the notes field (e.g., "call was made from +1XXXXXXXXXX to +1YYYYYYYYYY"), without notes there's no phone.

---

## Solution

Update the column matching in `hubspotCallParser.ts` to include "notes" as a search term:

```typescript
// Before
callSummary: headers.findIndex(h => h.includes('call summary') || h.includes('summary')),

// After  
callSummary: headers.findIndex(h => 
  h.includes('call summary') || 
  h.includes('meeting notes') || 
  h.includes('notes')
),
```

---

## Implementation

### Update Parser

**File: `src/utils/hubspotCallParser.ts`**

Modify line 294 to match more column name variations:

| Search Term | Matches |
|-------------|---------|
| `call summary` | "Call Summary" |
| `meeting notes` | "Call and meeting notes" |
| `notes` | "Notes", "Call notes" |

---

## After the Fix

1. Re-import the HubSpot CSV
2. The notes column will be properly mapped
3. Phone numbers will be extracted from the notes text
4. Both Email and Phone columns will be populated in Reports

