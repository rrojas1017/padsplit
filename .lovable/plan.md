
## Goal
Add a visible icon indicator to records that have detected pain point issues, making it immediately clear at a glance which records have issues without needing to look at the dedicated "Issues" column.

## Current State
- Issues are displayed only in a dedicated "Issues" column in the Reports table (far right of table)
- Small colored badges show which specific issues were detected
- Users must scroll right or look at a distant column to see if a record has pain points
- Summary card shows total count of records with issues but doesn't highlight individual problem records

## Proposed Solution

### 1. Add Issue Indicator Icon to Row (Leftmost Position)
Add a visual indicator at the beginning of each table row (near Record Date) that shows:
- **Colored icon badge** (ShieldAlert or AlertTriangle) when a record has detected issues
- **Icon color matches the primary issue** (if one issue, use that color; if multiple, use a blended or warning color)
- **Tooltip on hover** showing the list of detected issues for that record
- Works like the existing Churn Risk badge pattern (already implemented in the table)

### 2. Design Pattern
Follow the existing **Churn Risk Badge** component pattern:
- Place it immediately after the Record Date cell
- Use a small, visual indicator (icon + optional count badge)
- On hover, show tooltip with issue list
- Color-coded to match ISSUE_BADGE_CONFIG colors
- If multiple issues: show a badge with count "3 issues" with warning/alert color
- If single issue: show the icon with that issue's color

### 3. Visual Appearance
- **Icon**: Use `ShieldAlert` (already imported, matches the filter button)
- **Single issue**: Show icon in that issue's color (e.g., amber for Payment, red for Trust)
- **Multiple issues**: Show icon in a warning/alert orange with a count badge (e.g., "2" or "3")
- **Tooltip**: On hover, display all issues in a small popup ("Payment & Pricing Confusion, Transportation Barriers")

### 4. Implementation Details

**Component Enhancement:**
- No new component needed—add directly to the table row rendering where other badges are shown
- Reuse existing icon color logic from ISSUE_BADGE_CONFIG
- Place immediately after the Record Date column and before other data

**Table Structure:**
- Record Date | **[NEW] Issue Icon** | Move-In Date | Contact | ... | Churn Risk | Method | Issues Column (existing)

**Tooltip Logic:**
- Map issue categories to their display colors
- Show comma-separated list of issues
- Use existing Tooltip component from Radix UI

### 5. Files to Modify
- `src/pages/Reports.tsx`
  - Add Issue indicator display near the Record Date cell in the table row loop
  - Import and use Tooltip component (already available)
  - Reference ISSUE_BADGE_CONFIG for colors
  - Add logic to determine icon color based on number and type of issues

### 6. Benefits
✓ Issues are immediately visible without scrolling
✓ Consistent with existing design patterns (like Churn Risk badge)
✓ Color-coded for quick visual scanning
✓ Tooltip provides detail on hover
✓ Reduces cognitive load—users can spot problem records at a glance

### Implementation Order
1. Add issue indicator rendering in table row (after Record Date)
2. Add color logic (single vs. multiple issues)
3. Add Tooltip with issue list
4. Style to match existing badge patterns
