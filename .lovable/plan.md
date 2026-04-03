

# Replace MoveOutPatterns with MoveOutActionCenter Triage Table

## What Changes

The current `MoveOutPatterns.tsx` renders paragraph-style cards from `emerging_patterns` data. Replace it with a new `MoveOutActionCenter.tsx` that presents the same data as a scannable triage table with extracted "Who/What" and "Suggested Action" columns.

## Files

### 1. Create `src/components/moveout-insights/MoveOutActionCenter.tsx`
- Consumes `EmergingPattern[]` (same data as MoveOutPatterns)
- Renders a `Table` (shadcn) with columns: Priority, Pattern, Who/What, Cases, Suggested Action
- **Priority column**: Severity badge — red "Act Now", amber "Investigate", blue "Monitor" (uses existing `getSeverityLabel` logic from `watch_or_act` / `status` fields)
- **Pattern column**: `stripUUIDs(title)`, truncated to ~40 chars, full text in tooltip
- **Who/What column**: Parsed from `description` text:
  - Regex for agent names like "Agent Amir" or "Agent (Joseph)" → "Amir, Joseph"
  - Keyword detection: "host"→"Host issues", "onboarding"→"Onboarding", "payment"→"Payment process", "transfer"→"Transfer process", "listing/photos"→"Property listings", "roommate"→"Roommate matching"
  - Fallback: "Multiple cases"
- **Suggested Action column**: Mapped from pattern keywords:
  - agent + negative → "Schedule coaching review"
  - unaware/didn't know → "Update onboarding flow"
  - communication + follow-up → "Audit escalation SLA"
  - listing/photos/property condition → "Audit flagged listings"
  - payment/billing → "Review payment process"
  - transfer → "Review transfer workflow"
  - roommate → "Review matching criteria"
  - Fallback: "Review flagged cases"
- **Garbage filter**: Skip patterns where cleaned description < 20 chars or more commas than words
- Sort by case count desc, show top 10 with "Show all N" expand button
- Click row to expand full cleaned description
- Section header: "Action Center" with count badge

### 2. Update `src/components/moveout-insights/MoveOutOverview.tsx`
- Replace `MoveOutPatterns` import with `MoveOutActionCenter`
- Change the render from `<MoveOutPatterns data={...} />` to `<MoveOutActionCenter data={...} />`

### 3. No other files change
- `MoveOutPatterns.tsx` stays (unused, can be cleaned up later)
- No hook/data/type changes needed — same `EmergingPattern[]` data

## Technical Details
- Uses shadcn `Table`, `Badge`, `Button`, `Tooltip` components
- All text through `stripUUIDs()`, all percentages through `formatPercent()`
- Collapsible rows via local `useState` for expanded row index
- Entity extraction is best-effort regex/keyword — no AI call needed

