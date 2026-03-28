

## UI Refinement Pass — 5 Visual Fixes for Research Insights

### 1. ReasonCodeChart.tsx — Fix cramped bars

The chart uses Recharts `BarChart` with `layout="vertical"` and `margin={{ left: 180 }}`. The left margin is already generous. The real fix: reduce YAxis `width` from 170 to 150, and ensure the card has no width constraints. The bars already use `ResponsiveContainer width="100%"` so they fill available space. Minor tweak only.

**Changes (line 150-158):**
- Reduce `margin.left` from 180 to 160
- Reduce YAxis `width` from 170 to 150  
- Add `tickFormatter` to truncate long labels at 25 chars

### 2. TopActionsTable.tsx — Truncate long text

**Changes (lines 106, 113):**
- Action cell: add `max-w-[400px]`, wrap text in `<span>` with `line-clamp-2` and `title={row.action}`
- Impact cell: add `max-w-[250px]`, `line-clamp-1`, `title={desc}`

### 3. HostAccountabilityPanel.tsx — Infer severity from text

The component already handles both string and object formats. For string items, add `inferSeverity()` to detect critical/high/medium keywords and apply colored left borders.

**Changes:**
- Add `inferSeverity(text)` function checking for keywords (harassment, discrimination, illegal → critical; uninhabitable, unsafe, threatening → high; else medium)
- Map severity to border color classes
- Apply to string-format items in the render

### 4. AgentPerformanceCard.tsx — Parse markdown strings

The `strengths` field comes as a single string with `**bold**` markers. Currently rendered as one `<p>` tag.

**Changes:**
- Add `parseMarkdownItems(data)` that handles both `string` and `string[]`
- For strings: split on `**...**` patterns or newlines, extract meaningful segments
- Render as bullet list with emerald accent dots
- Cap at 5 visible items with "Show more" toggle
- Same treatment for `weaknesses` when it arrives as a string

### 5. EmergingPatternsPanel.tsx — Extract title from text

Pattern items may have `pattern` as a full paragraph. Extract a title.

**Changes:**
- Add `parsePattern(text)`: check for `**Title**` markdown prefix, else use first sentence (up to 80 chars) as title
- Render title in `font-medium` on first line, description below in `text-xs text-muted-foreground line-clamp-2`

### Files modified (5)

| # | File | Fix |
|---|---|---|
| 1 | `ReasonCodeChart.tsx` | Reduce left margin/YAxis width, truncate long labels |
| 2 | `TopActionsTable.tsx` | `line-clamp-2` on action, `line-clamp-1` on impact, `title` attrs |
| 3 | `HostAccountabilityPanel.tsx` | `inferSeverity()` for string items, colored left borders |
| 4 | `AgentPerformanceCard.tsx` | Parse markdown strings into bullet lists, cap at 5 |
| 5 | `EmergingPatternsPanel.tsx` | Extract title from pattern text, two-line layout |

No backend changes. No new files.

