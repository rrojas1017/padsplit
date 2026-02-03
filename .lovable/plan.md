

## Pain Point & Barrier Evolution Tracking

### Overview

Create a new **Pain Point Evolution Panel** that visually tracks how member concerns change over time across multiple analyses. This will answer: "Are issues getting better, worse, appearing, or disappearing?"

### Current State

**What exists today:**
- Each analysis already stores `trend_delta` and `is_emerging` flags on individual pain points (comparing to the previous analysis only)
- The `TrendBadge` component in `PainPointsPanel` shows NEW badges and +/-% changes
- `TrendChart` exists but only tracks sentiment over time, not pain point evolution
- Historical analyses are stored in `member_insights` table with full pain point arrays

**Limitation:** Current trend data only compares to the immediately previous analysis - there's no visualization of long-term patterns across multiple periods.

---

### Solution Design

**New Component: `PainPointEvolutionPanel.tsx`**

A dedicated panel that:
1. Fetches the last 5-10 completed analyses (regardless of current period filter)
2. Aggregates pain point categories across all analyses
3. Visualizes evolution with multiple chart types

**Location:** Add below the existing `PainPointsPanel` in the Booking Insights layout

---

### UI/UX Design

**Panel Layout:**

```text
┌─────────────────────────────────────────────────────────────────┐
│ 📈 Pain Point Evolution                               [?] Help  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Line Chart: Top 5 Pain Points Over Time]                      │
│  - X-axis: Analysis dates (Jan 15, Jan 22, Jan 29, Feb 3)       │
│  - Y-axis: Frequency %                                          │
│  - Lines: Each pain point category is a colored line            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Status Badges:                                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────────┐               │
│  │ 📈 Rising  │ │ 📉 Falling │ │ ✨ New Issues  │               │
│  │ 2 issues   │ │ 1 issue    │ │ 1 this period  │               │
│  └────────────┘ └────────────┘ └────────────────┘               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Issue Status Table:                                            │
│  ┌──────────────────────┬─────────┬───────────┬────────────────┐│
│  │ Pain Point           │ Current │ Trend     │ Status         ││
│  ├──────────────────────┼─────────┼───────────┼────────────────┤│
│  │ Payment Confusion    │ 38%     │ +8% ↑     │ 🔴 Worsening   ││
│  │ Move-In Timing       │ 31%     │ -5% ↓     │ 🟢 Improving   ││
│  │ Technical Issues     │ 19%     │ —         │ ⚪ Stable      ││
│  │ Trust & Property     │ 15%     │ NEW       │ 🟣 Emerging    ││
│  │ Transportation       │ —       │ -12%      │ 🟢 Resolved    ││
│  └──────────────────────┴─────────┴───────────┴────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Status Classifications:**
- **Worsening** (🔴): Frequency increased >5% vs previous analysis
- **Improving** (🟢): Frequency decreased >5% vs previous analysis  
- **Stable** (⚪): Change within ±5%
- **Emerging** (🟣): New issue not seen in previous 3+ analyses
- **Resolved** (🔵): Issue present before but not in current analysis

---

### Technical Implementation

**Phase 1: Data Aggregation Hook**

Create `src/hooks/usePainPointEvolution.ts`:

```typescript
interface EvolutionDataPoint {
  date: string;
  analysisId: string;
  dateRange: string;
  painPoints: Record<string, number>; // category -> frequency
}

interface PainPointStatus {
  category: string;
  currentFrequency: number | null;
  previousFrequency: number | null;
  trend: 'rising' | 'falling' | 'stable' | 'emerging' | 'resolved';
  trendDelta: number;
  firstSeen: string;
  lastSeen: string;
  occurrenceCount: number;
}

function usePainPointEvolution(limit?: number) {
  // Fetch last N completed analyses
  // Aggregate pain points across all
  // Calculate status for each category
  return { data, isLoading, statusSummary };
}
```

**Phase 2: Evolution Panel Component**

Create `src/components/member-insights/PainPointEvolutionPanel.tsx`:

- Uses Recharts `LineChart` for the trend visualization
- Shows summary badges for quick status overview
- Expandable table with full history per pain point

**Phase 3: Integration**

Update `BookingInsightsTab.tsx`:
- Import and render `PainPointEvolutionPanel` after `PainPointsPanel`
- Pass the existing `insights` array (already contains last 10 analyses)

---

### Data Flow

```text
member_insights table
        │
        ▼
┌───────────────────────────┐
│ usePainPointEvolution     │
│ - Fetches last 10 analyses│
│ - Aggregates categories   │
│ - Calculates trends       │
└───────────────────────────┘
        │
        ▼
┌───────────────────────────┐
│ PainPointEvolutionPanel   │
│ - Line chart over time    │
│ - Status badges           │
│ - Detailed table          │
└───────────────────────────┘
```

---

### Edge Cases Handled

1. **Single analysis only**: Show message "Run more analyses to see evolution trends"
2. **Category name variations**: Normalize category names (lowercase, trim) for matching
3. **Gaps in data**: Handle missing pain points gracefully (null in chart)
4. **New period types**: Works across all analysis periods, not filtered

---

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/usePainPointEvolution.ts` | Create | Data aggregation logic |
| `src/components/member-insights/PainPointEvolutionPanel.tsx` | Create | Main evolution visualization |
| `src/components/call-insights/BookingInsightsTab.tsx` | Modify | Add new panel to layout |

---

### Future Enhancements (Not in this scope)

- Filter by market to see market-specific evolution
- Export evolution data to CSV
- AI-generated summary of trends ("Payment confusion has worsened 15% over the last month, primarily in Atlanta")

