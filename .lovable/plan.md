

# Fix: HubSpot CSV Parser for Malformed Single-Line Format

## Problem
HubSpot exports sometimes produce CSVs where all records are concatenated on a single line without proper line breaks. Your file has 5.8 million characters on one line, containing multiple records that cannot be parsed with a simple line-split approach.

## Solution
Update the HubSpot CSV parser to detect and automatically split malformed single-line CSVs by identifying record boundaries using the Record ID pattern.

## Implementation

### 1. Update `hubspotCallParser.ts`

Add a new function to detect and fix malformed CSVs:

```typescript
function fixMalformedCSV(csvContent: string): string {
  // Detect if CSV is malformed (single line with multiple records)
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  if (lines.length > 2) {
    // CSV appears properly formatted
    return csvContent;
  }
  
  // Check for scientific notation Record IDs that indicate concatenated records
  // Pattern: look for digit sequences like "1.02E+11" or full IDs like "102000000000"
  // that appear after content and before a date pattern
  
  // Find header end position
  const headerMatch = csvContent.match(/Associated Contact IDs?/i);
  if (!headerMatch) return csvContent;
  
  const headerEndPos = headerMatch.index! + headerMatch[0].length;
  const dataContent = csvContent.substring(headerEndPos);
  
  // Split on Record ID patterns (scientific notation at start of record)
  // Pattern matches: number followed by date format (M/D/YY)
  const recordPattern = /(\d+\.\d+E\+\d+|\d{11,}),(\d{1,2}\/\d{1,2}\/\d{2,4})/g;
  
  let fixedContent = csvContent.substring(0, headerEndPos);
  let lastIndex = 0;
  let match;
  let isFirst = true;
  
  const dataPortion = csvContent.substring(headerEndPos);
  
  while ((match = recordPattern.exec(dataPortion)) !== null) {
    if (isFirst) {
      fixedContent += '\n';
      isFirst = false;
    } else {
      // Add content from last match to this match
      fixedContent += '\n';
    }
    // Content will be rebuilt with proper line breaks
  }
  
  // More robust approach: split on the Record ID pattern
  const records = dataPortion.split(/(?=\d+\.\d+E\+\d+,\d{1,2}\/|(?=\d{11,},\d{1,2}\/))/);
  
  fixedContent = csvContent.substring(0, headerEndPos);
  for (const record of records) {
    if (record.trim()) {
      fixedContent += '\n' + record.trim();
    }
  }
  
  return fixedContent;
}
```

### 2. Update `parseHubspotCSV` Function

Modify the main parsing function to call the fixer:

```typescript
export function parseHubspotCSV(csvContent: string): ParseResult {
  const errors: string[] = [];
  const records: ParsedCallRecord[] = [];
  const agentNames = new Set<string>();
  
  // FIRST: Try to fix malformed single-line CSV
  const fixedContent = fixMalformedCSV(csvContent);
  
  // Split into lines
  let lines = fixedContent.split('\n').filter(line => line.trim());
  
  // If still malformed, try alternative splitting
  if (lines.length <= 2) {
    // Try splitting on Record ID pattern directly
    const recordIdPattern = /(?=\d+\.\d+E\+\d+,)|(?=\d{11,},)/g;
    // ... alternative parsing logic
  }
  
  // ... rest of existing parsing logic
}
```

### 3. Alternative Approach: Smarter Record Detection

Instead of relying on line breaks, parse records by detecting:
1. Header row (everything before first Record ID in data)
2. Each record starts with a Record ID pattern: `1.02E+11` or 11+ digit number
3. Each record ends just before the next Record ID pattern

This makes the parser resilient to malformed exports.

## File Changes

| File | Change |
|------|--------|
| `src/utils/hubspotCallParser.ts` | Add `fixMalformedCSV()` function and update `parseHubspotCSV()` to handle single-line CSVs |

## Technical Details

The fix works by:
1. Detecting if CSV has all data on one line
2. Finding where the header ends (after "Associated Contact IDs")
3. Using regex to find Record ID boundaries: `\d+\.\d+E\+\d+,\d{1,2}\/` (scientific notation + date)
4. Inserting newlines before each Record ID to reconstruct proper CSV format
5. Then proceeding with normal parsing

### Test Cases
- Properly formatted CSV (should work as before)
- Single-line malformed CSV (your current file)
- Mixed line breaks (Windows `\r\n` vs Unix `\n`)

## Expected Result
After this fix, your file with ~200+ records on a single line will be correctly split and parsed, showing the classification summary with bookings vs non-bookings.

