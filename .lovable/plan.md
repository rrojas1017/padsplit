

## Drill Down from Reason Codes to Actual Records

### Problem
The Reason Code Distribution chart shows aggregated counts (e.g., "Positive, Planned & Unavoidable Churn: 34") but there's no way to see which specific records belong to each category.

### Solution
Make each reason code row in `ReasonCodeChart` clickable. Clicking opens a dialog/drawer showing the actual records whose `research_classification.primary_reason_code` matches that category.

### Implementation

#### 1. Create `ReasonCodeDrillDown` component
A dialog that receives the selected reason code string and queries `booking_transcriptions` joined with `bookings` where:
- `bookings.record_type = 'research'`
- `bookings.has_valid_conversation = true`
- `research_classification->>'primary_reason_code'` matches the selected code

Since PostgREST doesn't support direct JSONB text extraction filtering easily, we'll use a two-step approach:
- Fetch all processed research records (with `research_processing_status = 'completed'`)
- Client-side filter by `primary_reason_code` matching (fuzzy/contains match to handle slight AI wording variations)

The drill-down will display: member name, booking date, preventability score, root cause summary, and key quote. Each row will be collapsible for full classification details.

#### 2. Update `ReasonCodeChart` component
- Add `onClick` handler to each detail card row (the colored category rows at the bottom)
- Add visual affordance: cursor-pointer, hover state, and a small `ExternalLink` icon
- Track selected reason code in state, pass to `ReasonCodeDrillDown` dialog

#### 3. Data flow
- The report's `date_range_start`, `date_range_end`, and `campaign_id` will be passed through to scope the query correctly
- Records will be fetched on-demand when a reason code is clicked (not pre-loaded)

### Files changed
- `src/components/research-insights/ReasonCodeChart.tsx` — add click handlers, state, dialog trigger
- `src/components/research-insights/ReasonCodeDrillDown.tsx` — new component: dialog with record list

