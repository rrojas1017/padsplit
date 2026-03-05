

# Phase 4 & 5: Research Insights Dashboard + Prompt Management

## What We're Building

Replace the placeholder `ResearchInsights.tsx` with a full analytics dashboard that displays Prompt C output, and add prompt management in Settings.

## Phase 4: Research Insights Dashboard

### New Files

**`src/hooks/useResearchInsightsPolling.ts`**
- Clone of `useMemberInsightsPolling` but polling `research_insights` table instead of `member_insights`

**`src/hooks/useResearchInsightsData.ts`**
- Fetches research insights list + detail from `research_insights` table
- Fetches processing stats (how many records have `research_extraction` vs total research transcripts)
- Triggers `generate-research-insights` and `batch-process-research-records` edge functions
- Campaign filter support via `research_campaigns` table

**`src/pages/research/ResearchInsights.tsx`** (rewrite)
- Uses `DashboardLayout` (admin/supervisor view, not researcher sidebar)
- Controls bar: campaign filter, date range selector, "Generate Report" button, "Process All Records" backfill button, previous reports selector
- Processing status banner showing X/Y records processed
- In-progress polling banner
- Renders insight report sections via child components

### New Insight Display Components (`src/components/research-insights/`)

1. **`ExecutiveSummary.tsx`** — headline, key stats cards (addressable %, avg preventability, high-regret count, payment/host/roommate/life-event %)

2. **`ReasonCodeChart.tsx`** — horizontal bar chart (recharts) of `reason_code_distribution` with counts and avg preventability

3. **`IssueClustersPanel.tsx`** — collapsible cards per cluster showing: description, frequency badge, severity distribution, representative quotes (blockquote styled), systemic root cause, recommended action with priority/owner/effort badges, quick win callout

4. **`PaymentFrictionCard.tsx`** — stats from `payment_friction_analysis`: saveable %, extension awareness gap, miscommunication incidents, recommendation

5. **`TransferFrictionCard.tsx`** — stats from `transfer_friction_analysis`: unaware %, blocked by balance, would-have-retained count, recommendation

6. **`BlindSpotsPanel.tsx`** — list of `operational_blind_spots` with priority badges and detection method recommendations

7. **`HostAccountabilityPanel.tsx`** — `host_accountability_flags` with frequency, impact badges, enforcement and systemic fix

8. **`AgentPerformanceCard.tsx`** — avg questions covered, commonly skipped sections, coaching opportunities

9. **`TopActionsPanel.tsx`** — ranked action items with rank number, priority badge (P0 red, P1 amber, P2 blue), owner, effort, quick win

10. **`EmergingPatternsPanel.tsx`** — patterns with watch/investigate/act badges

11. **`HumanReviewQueue.tsx`** — list of records where `research_human_review = true` from `booking_transcriptions`, showing member name, date, reason code from classification

12. **`ProcessedRecordsList.tsx`** — expandable list of individually processed records, showing extraction + classification data, filterable by reason code and preventability score

### Component Design Pattern
- Each component receives its section of the Prompt C JSON as props
- Consistent use of Card, Badge, Collapsible from existing UI library
- Priority badges: P0 = `destructive` variant, P1 = amber, P2 = blue outline
- Quotes styled as indented blockquotes with quotation marks

## Phase 5: Prompt Management

**Add to `src/pages/Settings.tsx`** — new "Research Prompts" tab/section (super_admin only)
- Fetches from `research_prompts` table
- 3 cards (Extraction, Classification, Aggregation) each with:
  - Editable textarea for prompt text
  - Temperature slider
  - Model selector dropdown (from supported Lovable AI models)
  - Version display
  - Save button (updates row + increments version)

## Implementation Order
1. Polling hook + data hook
2. All 12 display components
3. Main ResearchInsights page assembly
4. Settings prompt management section

## Technical Notes
- Reuses existing patterns from `BookingInsightsTab` (controls, polling, previous analyses selector)
- All data comes from `research_insights.data` JSONB column — components destructure from there
- Processing stats query: count `booking_transcriptions` where `research_extraction IS NOT NULL` vs total research records with transcripts
- Uses `DashboardLayout` (not `ResearchLayout`) since this is an admin/supervisor view

