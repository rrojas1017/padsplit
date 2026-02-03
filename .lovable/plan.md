

## Fix Pain Point Evolution Panel - Wrong Field Name

### Problem

The Pain Point Evolution panel shows all 0% values because the hook is reading from the wrong field name.

**Current Code (line 145 in `usePainPointEvolution.ts`):**
```typescript
const frequency = pp.frequency_percent || 0;
```

**Actual Data Structure:**
```json
{
  "category": "Payment & Fee Confusion",
  "frequency": 60,  // <-- The actual field name
  "description": "...",
  "examples": [...]
}
```

The database stores `frequency` (a number like 60, 42, 28) but the hook expects `frequency_percent`.

### Solution

**File: `src/hooks/usePainPointEvolution.ts`**

Update the interface and field access:

```typescript
// Line 4-8: Update interface
interface PainPointData {
  category: string;
  frequency: number;       // Changed from frequency_percent
  frequency_percent?: number; // Keep as fallback
  quote?: string;
}

// Line 145: Update field access with fallback
const frequency = pp.frequency ?? pp.frequency_percent ?? 0;
```

This will:
1. Read from `frequency` field (what the database actually stores)
2. Fall back to `frequency_percent` for backwards compatibility
3. Default to 0 if neither exists

### Expected Result

After this fix:
- Chart will show actual frequency percentages (60%, 42%, 28%, etc.)
- Table will display real "Current" values instead of 0%
- Trend calculations will work correctly based on actual data

