

# STEP 11 — Treemap + Actionable Exports in Cluster Drill-Down

## Summary
Replace the sub-reason pie chart inside the **Reason Code drill-down** (`ReasonDrillDown`) with an interactive Recharts Treemap, add selection checkboxes to the breakdown table, and introduce export/action capabilities (Survey CSV, Call List CSV, Action Items, Copy Phones). Addressability drill-down and overview donuts stay untouched.

## Files

| File | Action |
|------|--------|
| `src/components/research-insights/ReasonCodeChart.tsx` | Major rewrite of `ReasonDrillDown` component |
| `src/utils/researchExport.ts` | Add CSV helpers + action item generator |

## Detailed Changes

### 1. `src/utils/researchExport.ts` — Export utilities

Add these functions (alongside any existing content):

- **`downloadCSV(rows, headers, filename)`** — generic CSV builder with proper escaping
- **`exportForSurvey(members)`** — builds full survey CSV (member_name, phone, reason_code, sub_reason, preventability_score, addressability, key_quote, case_summary, stated_reason, actual_reason, stated_vs_actual_match, move_out_date)
- **`exportCallList(members)`** — simplified CSV (member_name, phone, reason_summary, priority_notes based on score)
- **`copyPhones(members)`** — copies phones to clipboard, shows toast
- **`generateActionItems(subReason, count, cluster)`** — returns string[] of recommended actions using the keyword-based logic from the spec (Host → inspections/survey/flag hosts; Payment → payment plans/assistance; Roommate → compatibility review; etc.)

### 2. `src/components/research-insights/ReasonCodeChart.tsx` — Rewrite `ReasonDrillDown`

**Treemap replaces pie chart:**
- Import `Treemap, ResponsiveContainer, Tooltip` from recharts
- Build `treemapData` from `active.subReasons` with HSL color variations based on parent cluster hue
- Custom `CustomTreemapContent` SVG renderer showing name (truncated if block too small) and count
- Clicking a treemap block sets `selectedSubReason` filter state → filters member preview below

**Breakdown table enhancements:**
- Add `Checkbox` column for each sub-reason row
- "Select All" and "Select All High Priority" (avg prev score ≥ 7) buttons in header
- New "Actions" column with `DropdownMenu` per row: Export for Survey, Export Call List, Generate Action Items, Copy Phones
- Guard export buttons with `useIsAdmin()` — only show for admin/super_admin

**Fetch full member data:**
- Expand the existing `fetchMembers` query to also select `research_classification` fields needed for exports (case_brief, addressability, preventability_score, key_quotes, case_summary, stated_reason_summary, actual_reason_summary, stated_vs_actual_match)
- Store full member data in state, not just preview fields
- When sub-reasons are selected via checkbox or treemap click, filter member list accordingly
- Paginate member list (25 per page) when filtered to a sub-reason

**Floating action bar:**
- Fixed bottom bar appears when any checkboxes are selected (sub-reason or individual member level)
- Shows count of selected sub-reasons and total members
- Buttons: Export for Survey, Export Call List, Generate Action Items, Clear Selection
- Uses the export utilities from `researchExport.ts`

**Action Items modal:**
- Simple Dialog showing generated action items for selected sub-reasons
- "Copy to Clipboard" and "Export as Text" buttons
- Priority label (P0/P1/P2) based on cluster type and count

**Addressability drill-down explanation:**
- In the `AddressabilityDrillDown` cluster table, add a small italic text below each cluster name explaining WHY it's considered addressable/partially/not. Use the cluster name + bucket name to generate a 1-line explanation:
  - Addressable + Host Negligence → "Property issues that PadSplit could prevent through host accountability and maintenance enforcement"
  - Addressable + Payment → "Financial friction that could be reduced through better payment plans or fee transparency"
  - Not Addressable + External Life Event → "Life changes outside PadSplit's control"
  - etc.
- Store these as a simple mapping in the component

### Key preservation notes
- Main overview donuts: **no changes**
- Sub-reason extraction logic in `useReasonCodeCounts` and `useAddressabilityBreakdown`: **no changes**
- Addressability expandable sub-reason rows: **preserved as-is**
- `ReasonCodeDrillDown` (the Sheet component): **no changes**
- `MemberDetailPanel` integration: **preserved**

