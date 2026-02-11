

# Market Intelligence Dashboard + Churn Prediction System

## Feature 1: Market Intelligence Dashboard

A new page at `/market-intelligence` accessible to super_admin and admin roles, providing geographic and tabular views of PadSplit's performance across all 48 states and 560 cities.

### Data Sources (already available)
- **bookings table**: market_city, market_state, status, booking_date, move_in_date, call_duration_seconds (5,941 records across 560 cities, 48 states)
- **booking_transcriptions table**: call_key_points (sentiment, buyer intent, readiness, objections, member details like weekly budget), agent_feedback (QA scores)
- **member_insights table**: market_breakdown with AI-generated top concerns and unique patterns per market

### Dashboard Sections

**1. State-Level Heat Map (table-based with color intensity)**
Since we cannot use a real geographic map library without adding heavy dependencies, we will build a sortable state table with color-coded intensity columns:
- Total records, bookings, non-bookings
- Conversion rate (Moved In / total bookings) with color gradient (red < 15%, yellow 15-25%, green > 25%)
- Churn rate (Rejected + No Show + Cancelled / total bookings)
- Average call duration
- Dominant sentiment from transcription analysis

**2. City Drill-Down Panel**
Click a state row to expand and see all cities within it, with the same metrics plus:
- Top objections/concerns (from booking_transcriptions.call_key_points)
- Average buyer intent score (from call_key_points.buyerIntent.score)
- Average weekly budget mentioned (from call_key_points.memberDetails.weeklyBudget)

**3. Market Comparison Cards**
Top 10 markets by volume with mini sparkline-style indicators showing:
- Volume ranking
- Conversion rate vs. system average
- Unique market pattern (from member_insights.market_breakdown)

**4. Filters**
- Date range picker (reuse existing DateRangeFilter component)
- Minimum record threshold slider (to filter out markets with too few records for meaningful stats)

### Technical Implementation

**New files:**
- `src/pages/MarketIntelligence.tsx` -- main page
- `src/hooks/useMarketIntelligence.ts` -- data fetching hook that joins bookings + booking_transcriptions with server-side aggregation
- `src/components/market-intelligence/StateHeatTable.tsx` -- sortable state table with color intensity
- `src/components/market-intelligence/CityDrillDown.tsx` -- expandable city details
- `src/components/market-intelligence/MarketComparisonCards.tsx` -- top market cards
- `src/components/market-intelligence/MarketInsightPanel.tsx` -- AI-generated insights from member_insights.market_breakdown

**Modified files:**
- `src/App.tsx` -- add route `/market-intelligence`
- `src/components/layout/AppSidebar.tsx` -- add sidebar entry with Map icon under core group

**Database:** An edge function `aggregate-market-data` will run a SQL query joining bookings with booking_transcriptions to compute per-state and per-city aggregates (conversion rates, avg sentiment, avg buyer intent, avg budget). This avoids loading 6,000 records client-side. Results are cached in a new `market_intelligence_cache` table.

**New database table:**
```sql
CREATE TABLE market_intelligence_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text UNIQUE NOT NULL,
  state_data jsonb NOT NULL DEFAULT '[]',
  city_data jsonb NOT NULL DEFAULT '[]',
  generated_at timestamptz NOT NULL DEFAULT now(),
  filters jsonb DEFAULT '{}'
);
```

---

## Feature 2: Churn Prediction (Early Warning System)

A system that scores every "Pending Move-In" booking with a churn risk level and surfaces high-risk records to supervisors and admins before the move-in date.

### Churn Risk Signals (available data)

| Signal | Source | Weight |
|--------|--------|--------|
| Short call duration (< 3 min) | bookings.call_duration_seconds | High |
| Negative sentiment | booking_transcriptions.call_key_points.callSentiment | High |
| Low move-in readiness | booking_transcriptions.call_key_points.moveInReadiness = 'low' | High |
| Multiple objections raised | booking_transcriptions.call_key_points.objections (count) | Medium |
| Cold buyer intent (< 40) | booking_transcriptions.call_key_points.buyerIntent.score | High |
| Short time between booking and move-in (< 2 days) | booking_date vs move_in_date | Medium |
| Low agent QA scores | booking_transcriptions.agent_feedback.scores | Low |
| Market with high historical churn | bookings aggregate by market | Medium |
| Communication method = SMS only | bookings.communication_method | Low |

### Risk Score Calculation
A deterministic formula (no AI call needed) that runs client-side:
- Each signal contributes 0-15 points
- Total score 0-100, mapped to: **Low** (0-30), **Medium** (31-60), **High** (61-100)

### UI Components

**1. Churn Risk Column on Reports Page**
Add a color-coded risk badge to each "Pending Move-In" row in the Reports table:
- Green "Low Risk"
- Yellow "Medium Risk" 
- Red "High Risk"

**2. Churn Early Warning Panel (new component on Dashboard)**
A card showing:
- Count of High/Medium/Low risk pending move-ins
- List of top 10 highest-risk bookings with: member name, move-in date, risk score, top risk factors
- "Reach Out" action button linking to the booking detail

**3. Daily Churn Alert Notifications**
Extend the existing `admin_notifications` system: a scheduled check (triggered from `check-auto-transcription` or a new cron-like function) that scans Pending Move-In bookings with move-in dates in the next 3 days. If any are High Risk, insert a warning notification visible to super_admin.

### Technical Implementation

**New files:**
- `src/utils/churnPrediction.ts` -- deterministic risk scoring function
- `src/hooks/useChurnPrediction.ts` -- fetches pending bookings with transcription data, computes scores
- `src/components/dashboard/ChurnWarningPanel.tsx` -- dashboard early warning card
- `src/components/reports/ChurnRiskBadge.tsx` -- inline badge for reports table

**Modified files:**
- `src/pages/Dashboard.tsx` -- add ChurnWarningPanel below insights section (super_admin/admin only)
- `src/pages/Reports.tsx` -- add churn risk column for Pending Move-In records
- `supabase/functions/transcribe-call/index.ts` -- after processing, check if the booking is Pending Move-In and high-risk, insert admin_notification

**No new database tables needed** -- the churn score is computed on-the-fly from existing data in bookings + booking_transcriptions.

---

## Implementation Order

1. **Market Intelligence** -- new page, hook, components, edge function, database table, route, sidebar entry
2. **Churn Prediction** -- scoring utility, hook, UI components on Dashboard + Reports, notification integration

## Estimated Scope
- 8 new files
- 5 modified files  
- 1 new database table (market_intelligence_cache)
- 1 new edge function (aggregate-market-data)
