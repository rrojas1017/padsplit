

# Fix: Sub-Reason Treemap Click Shows Wrong Data (0 cases / 346 members)

## Problem
Two bugs when clicking a treemap block (e.g., "Unsanitary / Dirty Conditions — 16"):

1. **Header says "0 cases"** — `reasonCount` is set to `bookingIds.length`, but `bookingIds` is empty
2. **Shows 346 members** — when `bookingIds` is empty, `ReasonCodeDrillDown` falls back to a broad keyword search that matches everything in the parent cluster

**Root cause**: Sub-reasons are derived using `extractSubReason(cluster, caseBrief)` — keyword matching on `case_brief` text. But `getMembersForSubReason` tries to match against `reason_detail` / `primary_reason_code`, which are completely different fields. Result: 0 matches → empty bookingIds → keyword fallback.

## Solution
Fix `getMembersForSubReason` to use the same logic as `useReasonCodeCounts`: apply `mapToCluster` + `extractSubReason` on each member's data, then match the derived sub-reason name.

Also pass the actual count from `subData` instead of relying on `bookingIds.length`.

## Changes

| File | Change |
|------|--------|
| `src/components/research-insights/ReasonCodeChart.tsx` | 1) Fix `getMembersForSubReason` to derive sub-reason via `extractSubReason(active.name, caseBrief)` and match against the sub-reason name; 2) Pass actual count from `subData` as `reasonCount` instead of `bookingIds.length`; 3) Import `extractSubReason` from reason-code-mapping |

### Detail

**`getMembersForSubReason` fix** (line ~334):
```typescript
import { extractSubReason } from '@/utils/reason-code-mapping';

const getMembersForSubReason = (subName: string) => {
  return allMembers.filter(m => {
    const caseBrief = m.caseSummary || '';
    const derived = extractSubReason(active.name, caseBrief);
    return derived.toLowerCase() === subName.toLowerCase();
  });
};
```

**Pass real count** — where `subReasonDrillDown` is set (treemap click + table row click), also store the count from `subData`:
```typescript
// In state
const [subReasonDrillDown, setSubReasonDrillDown] = useState<{
  name: string; bookingIds: string[]; count: number;
} | null>(null);

// On click
const sub = subData.find(s => s.name === name);
setSubReasonDrillDown({ name, bookingIds: ids, count: sub?.value || ids.length });

// In render
reasonCount={subReasonDrillDown.count}
```

**Also fix the member fetch** — the current fetch (line ~207) uses `.limit(500)` and matches on `reason_detail` which misses records. Instead, apply `extractSubReason` during the filter step of the already-fetched data, matching `caseSummary` (case_brief) the same way the hooks do.

This ensures the treemap click → drill-down shows exactly the 16 members that belong to "Unsanitary / Dirty Conditions", with the correct count in the header.

