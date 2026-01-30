

# Redesign Non-Booking Analysis Tab for Insights Focus

## Problem

The current Non-Booking Analysis tab is inconsistent with the Booking Insights tab:
- It includes a records list (CallsTable) which is redundant with the Reports page
- It has search/filter controls for browsing individual records
- The layout doesn't match the insights-focused design of Booking Insights

## Goal

Redesign Non-Booking Analysis to be a pure insights page, mirroring the Booking Insights layout and preparing for the future AI analysis edge function.

## Proposed Layout Comparison

| Booking Insights Tab | Non-Booking Analysis Tab (Redesigned) |
|---------------------|---------------------------------------|
| InsightsSummaryCards | NonBookingSummaryCards (modified) |
| PainPointsPanel + ObjectionsChart | NonBookingReasonsPanel + ObjectionsChart |
| SentimentChart + MarketInsights | SentimentChart + MarketInsights |
| TrendChart | TrendChart |
| RecommendationsPanel | RecommendationsPanel |

## Detailed Changes

### 1. NonBookingAnalysisTab.tsx - Complete Refactor

**Remove:**
- All filter controls (search, agent, status dropdowns)
- CallsTable component
- Nested Tabs component (all/with-recording)
- CallDetailsModal

**Keep/Enhance:**
- Date range selector
- Run Analysis button
- NonBookingSummaryCards (will be fed by AI analysis)
- NonBookingReasonsChart
- MissedOpportunitiesPanel

**Add:**
- Previous Analyses selector (like Booking Insights)
- SentimentChart for non-bookers
- RecommendationsPanel for recovery strategies
- Proper empty state with "Run Analysis" CTA
- Loading skeleton states

### 2. New Data Structure for Non-Booking Insights

Will create a `non_booking_insights` table (future database migration) with similar structure to `member_insights`:

```text
non_booking_insights
├── id
├── analysis_period
├── date_range_start / date_range_end
├── total_calls_analyzed
├── rejection_reasons (why they didn't book)
├── objection_patterns
├── missed_opportunities (high-readiness non-bookers)
├── sentiment_distribution
├── recovery_recommendations
├── agent_breakdown (which agents have highest non-booking rates)
├── status (processing/completed/failed)
└── created_at
```

### 3. UI Layout for Redesigned Tab

```text
Non-Booking Analysis Tab
├── Controls Row
│   ├── Date Range Selector
│   ├── Run Analysis Button (triggers edge function)
│   ├── Export Button
│   └── Previous Analyses Selector
│
├── Summary Cards Row (4 cards)
│   ├── Total Non-Booking Calls
│   ├── Top Rejection Reason
│   ├── Overall Sentiment
│   └── Recovery Potential
│
├── Analytics Row 1 (2-column)
│   ├── NonBookingReasonsChart (why they didn't book)
│   └── ObjectionsChart (shared component)
│
├── Analytics Row 2 (2-column)
│   ├── SentimentChart
│   └── MissedOpportunitiesPanel (high-readiness)
│
├── Trend Chart (full width)
│   └── Shows non-booking trends over time
│
└── Recovery Recommendations Panel
    └── AI-generated strategies to recover non-bookers
```

### 4. Empty State Design

When no analysis has been run:
```text
┌─────────────────────────────────────────────────┐
│                                                 │
│      [Lightbulb Icon - amber color]            │
│                                                 │
│      No Non-Booking Analysis Yet               │
│                                                 │
│      Run your first analysis to discover       │
│      why members didn't book and how to        │
│      recover missed opportunities              │
│                                                 │
│           [Run First Analysis]                 │
│                                                 │
│      3,286 non-booking calls available         │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 5. Files to Modify

| File | Changes |
|------|---------|
| `src/components/call-insights/NonBookingAnalysisTab.tsx` | Complete refactor to insights-focused layout |
| `src/components/call-insights/NonBookingSummaryCards.tsx` | Adapt to use insight data instead of raw calls |
| `src/components/call-insights/NonBookingReasonsChart.tsx` | Already prepared for insight data |
| `src/components/call-insights/MissedOpportunitiesPanel.tsx` | Adapt to use AI-analyzed high-readiness data |

### 6. Files to Create

| File | Purpose |
|------|---------|
| `src/components/call-insights/NonBookingRecommendationsPanel.tsx` | Recovery recommendations panel |
| `src/hooks/useNonBookingInsightsPolling.ts` | Polling hook for background analysis |

### 7. Implementation Phases

**Phase 1 (UI Only - This Plan):**
- Refactor NonBookingAnalysisTab to insights-focused layout
- Create placeholder components for future AI data
- Show "Run Analysis" empty state
- Wire up date range and analysis controls (non-functional for now)

**Phase 2 (Future - Backend):**
- Create `non_booking_insights` database table
- Create `analyze-non-booking-insights` edge function
- Connect UI to real analysis pipeline

## Technical Notes

- The refactored tab will use the same component patterns as BookingInsightsTab
- Analysis button will be disabled with "Coming Soon" tooltip until Phase 2
- NonBookingSummaryCards will show basic stats from bookings table (current behavior) until AI analysis is available
- The date range selector will be shared with the parent component

