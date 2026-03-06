

## Fix: Reason Code Distribution Missing Labels

### Problem
The `reason_code_distribution` in the latest report is stored as a **raw array** with `reason_group` fields, but the `Array.isArray(data)` branch in `ReasonCodeChart` maps `d.code` (which doesn't exist in the data), resulting in `undefined` names for every row.

The data shape is:
```json
[{ "reason_group": "...", "count": 42, "percentage": 36.8, "description": "..." }, ...]
```

But the code expects `{ code, count, pct }` for the array format.

### Fix

**File: `src/components/research-insights/ReasonCodeChart.tsx`**

Update the `Array.isArray(data)` branch (line 56) to handle both the legacy `{ code, count, pct }` format AND the current `{ reason_group, count, percentage, description }` format:

```typescript
if (Array.isArray(data)) {
  chartData = data.map(d => ({
    name: d.code || d.reason_group || d.category || 'Unknown',
    count: d.count,
    pct: d.pct ?? d.percentage ?? 0,
    details: d.details || d.description,
    bookingIds: d.booking_ids,
    includedCodes: d.reason_codes_included,
  }));
}
```

Also update the `ReasonCodeChartProps` interface to allow the array items to have either shape, broadening the array element type to include `reason_group`, `percentage`, `description`, `booking_ids`, and `reason_codes_included`.

### Scope
- Single file change: `src/components/research-insights/ReasonCodeChart.tsx`
- No backend changes needed

