
# Unified Call Insights Page - UI Design

## Overview

Refactor the current `/call-insights` page to become a comprehensive unified Call Insights hub with two main sections accessible via tabs:
1. **Booking Insights** (current Member Insights functionality)
2. **Non-Booking Analysis** (current Call Insights with enhanced analytics UI)

This consolidates two separate pages into one cohesive analytics experience while reusing existing components and maintaining the modern UI design language established in the app.

## Current State

| Page | Route | Purpose | Components Used |
|------|-------|---------|-----------------|
| Member Insights | `/member-insights` | AI analysis of successful booking calls | InsightsSummaryCards, PainPointsPanel, ObjectionsChart, SentimentChart, MarketInsights, TrendChart, RecommendationsPanel |
| Call Insights | `/call-insights` | List non-booking records | CallInsightsStats, CallsTable, CallDetailsModal |

## Proposed Unified Structure

```text
/call-insights (Unified Call Insights)
├── Header with icon + title + date range + Run Analysis button
├── Stats Overview (combined high-level metrics)
│
├── TabsList
│   ├── "Booking Insights" - Member insights analytics
│   └── "Non-Booking Analysis" - Why they didn't book
│
└── TabsContent
    ├── Booking Insights Tab
    │   ├── InsightsSummaryCards (reused)
    │   ├── PainPointsPanel + ObjectionsChart (reused)
    │   ├── SentimentChart + MarketInsights (reused)
    │   ├── TrendChart (reused)
    │   └── RecommendationsPanel (reused)
    │
    └── Non-Booking Analysis Tab
        ├── NonBookingSummaryCards (NEW - adapted from InsightsSummaryCards)
        ├── NonBookingReasonsChart (NEW - placeholder for future AI analysis)
        ├── MissedOpportunitiesPanel (NEW - high-readiness non-bookers)
        ├── CallsTable (reused, with filters)
        └── Empty state prompting to process calls for insights
```

## File Changes

### Modified Files

| File | Changes |
|------|---------|
| `src/pages/CallInsights.tsx` | Complete refactor to unified tabbed interface |
| `src/components/layout/AppSidebar.tsx` | Update navigation: rename item, adjust icon |
| `src/App.tsx` | Add redirect from `/member-insights` to `/call-insights` |

### New Files

| File | Purpose |
|------|---------|
| `src/components/call-insights/NonBookingSummaryCards.tsx` | Summary cards for non-booking analytics |
| `src/components/call-insights/NonBookingReasonsChart.tsx` | Placeholder chart for "why they didn't book" |
| `src/components/call-insights/MissedOpportunitiesPanel.tsx` | Panel showing high-readiness non-bookers |
| `src/components/call-insights/BookingInsightsTab.tsx` | Container for booking insights (member insights reuse) |
| `src/components/call-insights/NonBookingAnalysisTab.tsx` | Container for non-booking analysis |

## Detailed Component Design

### 1. Unified CallInsights Page

**Header Section:**
- Icon: Brain or Lightbulb (replacing Phone)
- Title: "Call Insights"
- Subtitle: "AI-powered analysis of call patterns and trends"
- Date range selector (shared across both tabs)
- Run Analysis button

**Combined Stats Row:**
- Total Calls Analyzed (booking + non-booking)
- Conversion Rate (bookings / total)
- Top Pain Point (from booking insights)
- Average Call Duration

**Tabs:**
- "Booking Insights" - Successful conversions analysis
- "Non-Booking Analysis" - Missed opportunities and patterns

### 2. NonBookingSummaryCards Component

Adapted from InsightsSummaryCards for non-booking context:

| Card | Description |
|------|-------------|
| Total Non-Booking Calls | Count from filtered date range |
| Transcribed | Number with completed transcriptions |
| High Readiness | Members who seemed ready but didn't book |
| Avg Duration | Average call length for non-bookings |

### 3. NonBookingReasonsChart Component

Placeholder chart displaying:
- "Why They Didn't Book" as title
- Empty state: "Run analysis to discover patterns"
- When data exists: Horizontal bar chart of rejection reasons
- Design matches ObjectionsChart styling

### 4. MissedOpportunitiesPanel Component

Panel highlighting missed opportunities:
- Title: "Missed Opportunities"
- Shows non-booking calls where moveInReadiness was "high"
- Each entry shows: member name, date, readiness level, objections
- Empty state: "No high-readiness non-bookers found"
- Clicking an entry opens CallDetailsModal

### 5. BookingInsightsTab Component

Container that wraps existing member insights components:
- Previous Analyses selector
- InsightsSummaryCards
- PainPointsPanel + ObjectionsChart
- SentimentChart + MarketInsights
- TrendChart
- RecommendationsPanel

Uses existing `useMemberInsightsPolling` hook for analysis.

### 6. NonBookingAnalysisTab Component

Container for non-booking analysis:
- Filter row (search, agent, status, date range)
- NonBookingSummaryCards
- NonBookingReasonsChart (placeholder)
- MissedOpportunitiesPanel
- CallsTable with recordings
- CallDetailsModal for detail view

Uses existing data fetch from bookings table with `status = 'Non Booking'`.

## Navigation Updates

### AppSidebar.tsx Changes

**Before:**
```typescript
{
  icon: Phone,
  label: 'Non Booking Insights',
  path: '/call-insights',
  roles: ['super_admin', 'admin', 'supervisor'],
  group: 'core'
},
// ... in admin group:
{
  icon: Lightbulb,
  label: 'Member Insights',
  path: '/member-insights',
  roles: ['super_admin', 'admin'],
  group: 'admin'
},
```

**After:**
```typescript
{
  icon: Lightbulb,
  label: 'Call Insights',
  path: '/call-insights',
  roles: ['super_admin', 'admin', 'supervisor'],
  group: 'core'
},
// Remove Member Insights from admin group (consolidated)
```

### App.tsx Routing

Add redirect for backward compatibility:
```typescript
// Redirect old route to new unified page
<Route path="/member-insights" element={<Navigate to="/call-insights?tab=bookings" replace />} />
```

## UI Design Details

### Color Scheme (matching existing design)
- Booking Insights: Primary/accent colors (success-focused)
- Non-Booking Analysis: Amber/orange tones (opportunity-focused)
- Missed Opportunities: Destructive red for urgency

### Tab Badges
- "Booking Insights" tab shows count of analyzed calls
- "Non-Booking Analysis" tab shows total non-booking count

### Empty States
Each section has appropriate empty states:
- Booking Insights: "Run your first analysis to discover member trends"
- Non-Booking: "No non-booking calls found. Import calls to analyze patterns."
- Reasons Chart: "Process calls and run analysis to discover why members didn't book"

### Loading States
- Skeleton loaders matching existing patterns
- Spinner with "Loading insights..." text

## Data Flow

### Booking Insights Tab
1. Fetches from `member_insights` table (existing)
2. Uses `useMemberInsightsPolling` for background analysis
3. Invokes `analyze-member-insights` edge function

### Non-Booking Analysis Tab
1. Fetches from `bookings` table where `status = 'Non Booking'`
2. No processing in this phase (UI preparation only)
3. Future: Will use new `analyze-non-booking-insights` edge function

## Implementation Order

1. Create new component files with empty/placeholder structures
2. Create BookingInsightsTab with existing member insights logic
3. Create NonBookingAnalysisTab with current call insights logic
4. Refactor CallInsights page to use tabbed structure
5. Update AppSidebar navigation
6. Add routing redirect in App.tsx
7. Test both tabs function correctly

## Migration Notes

- The `/member-insights` route will redirect to `/call-insights?tab=bookings`
- All existing functionality preserved in respective tabs
- No database changes required for UI phase
- Future phase will add `non_booking_insights` table and edge function
