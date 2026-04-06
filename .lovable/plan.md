

# Fix: Replace "API Submission" Labels with Member Name or Phone

## Problem
The drill-down panel displays raw `member_name` from the `bookings` table, which for API-submitted records is "API Submission - +1234567890". This is unhelpful — it should show the actual member name (extracted from transcript) or just the clean phone number.

## Solution
In the `mapRecords` function of `ReasonCodeDrillDown.tsx`, detect names starting with "API Submission" and replace them:
1. Check if `research_classification` has an extracted name (e.g., `cls.member_name` or `cls.respondent_name`)
2. If not, fall back to the clean phone number from `contact_phone`
3. If neither exists, show the phone number stripped from the "API Submission - " prefix

## Change

| File | Change |
|------|--------|
| `src/components/research-insights/ReasonCodeDrillDown.tsx` | In `mapRecords` (~line 155), add logic to clean up "API Submission" names — extract real name from classification data or fall back to phone number |

```typescript
// Line 155 replacement logic
const rawName = b?.member_name || '';
const isApiPlaceholder = rawName.startsWith('API Submission');
const extractedName = cls?.respondent_name || cls?.member_name || '';
const cleanPhone = b?.contact_phone || rawName.replace('API Submission - ', '');
const memberName = isApiPlaceholder
  ? (extractedName || cleanPhone || 'Unknown')
  : (rawName || 'Unknown');
```

This applies to both query paths (bookingIds and keyword-match), since both go through `mapRecords`.

