

## Drill-Down from Reason Code Distribution to Exact Records

### Problem
The Reason Code Distribution chart shows grouped categories (e.g., "Host, Property & Safety Failures — 44") but there's no way to see which exact records fall into each group. The grouping is also done entirely by the AI during aggregation (Prompt C), with no stored mapping back to individual records — making it opaque and potentially inaccurate.

### Solution

**Two changes:**

1. **Include record-level mapping in the AI aggregation output** — modify the Prompt C schema so each reason code group includes a list of `booking_ids` or `member_names` that belong to it. This creates a verifiable, transparent link between the aggregate view and the source records.

2. **Make the ReasonCodeChart clickable to show a drill-down panel** — when an admin clicks a reason group (e.g., "Host, Property & Safety Failures"), a drawer/modal opens showing the exact records with their individual `primary_reason_code`, member name, date, preventability score, and case brief.

### Implementation

**1. Update `generate-research-insights/index.ts` — Prompt C schema**

Add `reason_codes_included` and `booking_ids` fields to each item in the `reason_code_distribution` array:

```json
"reason_code_distribution": {
  "distribution": [
    {
      "reason_group": "Group label",
      "count": 0,
      "percentage": 0.0,
      "details": "Why grouped this way",
      "reason_codes_included": ["Host Negligence / Property Condition", "Safety Concern"],
      "booking_ids": ["uuid1", "uuid2"]
    }
  ],
  "methodology": "How groups were determined"
}
```

Also pass `booking_id` into each record summary sent to the AI so it can reference them back. The edge function already builds `recordSummaries` from classifications — just add the booking_id from the query.

**2. Create `src/components/research-insights/ReasonCodeDrillDown.tsx`**

A Sheet/Drawer component that:
- Accepts a reason group name + list of booking_ids (from the report data)
- Falls back to querying `booking_transcriptions` where `research_classification->>'primary_reason_code'` matches the `reason_codes_included` list
- Shows each record: member name, date, individual reason code, preventability score, addressability, case brief
- Allows clicking through to the full record detail

**3. Update `ReasonCodeChart.tsx`**

- Make each bar and detail card clickable
- Pass an `onGroupClick(groupName, bookingIds, reasonCodes)` callback
- Parent (`ResearchInsights.tsx`) manages drill-down state and renders the drawer

**4. Update `ResearchInsights.tsx`**

- Add state for selected reason group
- Render `ReasonCodeDrillDown` when a group is selected
- Pass the report data's booking_ids for that group, with a DB fallback query

### Accuracy safeguard

The fallback query ensures accuracy even if the AI's grouping is imperfect: when `booking_ids` are missing from the report data, the drill-down queries `booking_transcriptions` directly using the `reason_codes_included` array and matches against each record's `research_classification->>primary_reason_code`. This means the records shown are always ground-truth from the database, not just what the AI claims.

