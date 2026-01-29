
# Fix Phone Enrichment Parser

## Root Cause

The CSV export from Apple Numbers is not being parsed correctly. The current parser works with standard CSV but may be failing due to:

1. **Column detection issue** - Headers like "Contact Name" and "Phone Number" contain spaces
2. **Apple Numbers CSV quirks** - May use different delimiters or encoding

## Current State (from your screenshot)

| Metric | Value | Issue |
|--------|-------|-------|
| Contacts in File | 5,446 | File was read |
| With Phone | 0 | Parser failed to extract phones |
| Records Need Phone | 4,791 | Database query works |
| Potential Matches | 0 | No phones = no matches |
| Sample Contacts | All dashes | Columns not detected |

## Database Verification

The emails in your database (e.g., `k7275062@gmail.com`) match exactly with the emails in your file (e.g., `<k7275062@gmail.com>` after cleaning angle brackets). Once parsing works, we will get matches.

## Fix

Update the parser to:

1. **Better column detection** - Handle multi-word headers like "Contact Name" and "Phone Number"
2. **Debug logging** - Add console logs to see what's being parsed (temporary)
3. **Fallback column indices** - If headers aren't detected, try common positions (0, 1, 2)

### Updated Column Detection

```typescript
function detectColumns(headers: string[]): { nameCol: number; emailCol: number; phoneCol: number } {
  const lowerHeaders = headers.map(h => (h || '').toLowerCase().trim());
  
  let nameCol = -1;
  let emailCol = -1;
  let phoneCol = -1;
  
  for (let i = 0; i < lowerHeaders.length; i++) {
    const h = lowerHeaders[i];
    
    // Match "contact name", "name", "contact"
    if (nameCol === -1 && (h.includes('name') || h === 'contact')) {
      nameCol = i;
    }
    
    // Match "email", "e-mail"
    if (emailCol === -1 && h.includes('email')) {
      emailCol = i;
    }
    
    // Match "phone number", "phone", "mobile", "tel"
    if (phoneCol === -1 && (h.includes('phone') || h.includes('mobile') || h.includes('tel'))) {
      phoneCol = i;
    }
  }
  
  // Fallback: assume standard order if detection fails
  if (nameCol === -1 && headers.length >= 1) nameCol = 0;
  if (emailCol === -1 && headers.length >= 2) emailCol = 1;
  if (phoneCol === -1 && headers.length >= 3) phoneCol = 2;
  
  console.log('Detected columns:', { nameCol, emailCol, phoneCol, headers: lowerHeaders });
  
  return { nameCol, emailCol, phoneCol };
}
```

### Enhanced CSV Row Parsing

Add debugging and handle edge cases:

```typescript
export function parseCSV(content: string): ContactParseResult {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  
  console.log('CSV parsing - Total lines:', lines.length);
  console.log('First line (headers):', lines[0]);
  if (lines[1]) console.log('Second line (first data):', lines[1]);
  
  // ... rest of parsing
}
```

## Expected Result After Fix

| Metric | Before | After |
|--------|--------|-------|
| Contacts in File | 5,446 | 5,446 |
| With Phone | 0 | ~5,400 |
| Potential Matches | 0 | ~4,700+ |

## Files to Modify

| File | Change |
|------|--------|
| `src/utils/contactEnrichmentParser.ts` | Add fallback column detection, debug logging |
