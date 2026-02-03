

## Add Buyer Intent Scoring to Non-Booking Analysis Pipeline

Enhance the Non-Booking call analysis system with a **Buyer Intent Score** that quantifies conversion probability, enabling data-driven lead recovery prioritization for calls that didn't result in a booking.

### Summary

Non-Booking records represent potential revenue that wasn't captured. By adding a quantitative **Buyer Intent Score (0-100)** extracted during transcription analysis, agents and supervisors can identify which non-bookers are most likely to convert on follow-up, prioritize outreach accordingly, and track intent trends across markets and time periods.

### What Is Buyer Intent?

A composite score predicting conversion likelihood based on signals extracted from the call:

| Signal Category | Positive Indicators (+score) | Negative Indicators (-score) |
|-----------------|------------------------------|------------------------------|
| **Urgency** | "Need to move ASAP", specific move-in date | "Just looking", "no rush" |
| **Budget Clarity** | Stated budget, payment method ready | Vague on budget, price objections |
| **Decision Authority** | "I can decide", solo caller | "Need to ask spouse", "checking for a friend" |
| **Engagement** | Asked detailed questions, requested tours | Passive, short responses |
| **Commitment Signals** | Asked about deposits, move-in process | Comparison shopping, objections |

**Intent Levels:**
- 🔥 **Hot (75-100)**: High conversion probability, prioritize immediate follow-up
- 🟠 **Warm (40-74)**: Interested but needs nurturing, schedule callback
- 🔵 **Cold (0-39)**: Low immediate potential, add to long-term nurture list

### Changes

**Phase 1: Call-Level Intent Extraction (Non-Booking Only)**

**File: `src/types/index.ts`**
- Add `BuyerIntent` interface:
```typescript
export interface BuyerIntent {
  score: number;           // 0-100
  intentLevel: 'hot' | 'warm' | 'cold';
  positiveSignals: string[];
  negativeSignals: string[];
  decisionMaker: boolean;
  timeframe: 'immediate' | 'this_week' | 'this_month' | 'exploring';
}
```
- Extend `CallKeyPoints` to include `buyerIntent?: BuyerIntent`

**File: `supabase/functions/transcribe-call/index.ts`**
- Modify both `buildDynamicPrompt()` and `buildDefaultPrompt()` to conditionally extract buyer intent when the booking status is "Non Booking":
```json
"buyerIntent": {
  "score": 72,
  "intentLevel": "warm",
  "positiveSignals": ["Asked about specific property", "Mentioned move-in timeline"],
  "negativeSignals": ["Comparing with other options", "Budget concerns"],
  "decisionMaker": true,
  "timeframe": "this_week"
}
```
- Add scoring logic guidance in the prompt for consistent extraction

**Phase 2: Non-Booking UI Components**

**File: `src/components/call-insights/NonBookingSummaryCards.tsx`**
- Add a 5th summary card: **"Hot Leads"** showing count of intent score ≥75
- Change "High Readiness" card subtitle to reference both readiness AND high intent

**New File: `src/components/call-insights/BuyerIntentIndicator.tsx`**
- Visual component showing intent score as a gauge/badge
- Color-coded: green (hot), orange (warm), blue (cold)
- Tooltip with positive/negative signals

**File: `src/components/call-insights/NonBookingMissedOpportunitiesPanel.tsx`**
- Integrate intent scores to sort missed opportunities by intent level
- Show "🔥 Hot Leads" section at top with highest-intent non-bookers
- Add intent score badge alongside existing urgency badge

**Phase 3: Aggregate Intent Analytics in Non-Booking Insights**

**File: `supabase/functions/analyze-non-booking-insights/index.ts`**
- Pre-compute intent distribution from `call_key_points.buyerIntent` field:
  - Count of hot/warm/cold leads
  - Average intent score
  - Intent by market breakdown
- Pass these metrics to AI analysis for contextualized recommendations
- Store aggregated intent data in the `non_booking_insights` record

**File: `src/components/call-insights/NonBookingAnalysisTab.tsx`**
- Add intent distribution visualization (pie chart or segmented bar)
- Show "Recovery Potential" score based on aggregate hot/warm leads

**New File: `src/components/call-insights/IntentDistributionChart.tsx`**
- Pie/bar chart showing hot/warm/cold distribution
- Click-through to filter Reports by intent level

**Phase 4: Follow-Up Priority Integration**

**File: `src/utils/followUpPriority.ts`**
- Integrate buyer intent into priority calculation:
  - Hot intent (75+) → URGENT priority (previously relied only on readiness)
  - Warm intent + no contact 3+ days → HIGH priority
  - Include intent score in priority reason text

**File: `src/components/reports/ContactProfileHoverCard.tsx`**
- Add Buyer Intent indicator for Non-Booking records
- Show positive/negative signals in hover content

### Database Considerations

No schema migrations required:
- Buyer intent data stored within existing `call_key_points` JSONB column in `booking_transcriptions`
- Aggregate intent metrics stored in existing JSONB columns of `non_booking_insights`
- SQL aggregation functions (`get_non_booking_stats`) may be extended to count high-intent calls

### Intent Score Calculation Logic (AI Prompt Guidance)

```text
+20: Specific move-in date within 7 days
+15: Budget confirmed and within PadSplit range ($150-$250/week)
+15: Asked about booking/move-in process or deposits
+10: Single decision maker confirmed
+10: First-time caller with specific property interest
+5:  Positive call sentiment
+5:  Asked follow-up questions

-10: "Just looking" or "researching for someone else"
-15: Price objections unresolved at call end
-15: Decision maker absent ("need to ask my wife")
-10: Comparison shopping explicitly mentioned
-10: No specific timeline mentioned
-5:  Negative call sentiment
```

### User-Facing Benefits

1. **Prioritized Follow-Up**: Agents see hot leads at the top of their non-booking list
2. **Recovery Campaigns**: Marketing can target warm leads with specific messaging
3. **Coaching Insights**: Identify why high-intent leads didn't convert (agent improvement)
4. **Trend Analysis**: Track intent distribution changes over time/markets

### Technical Notes

- Intent scoring applied only to Non-Booking records (existing logic unchanged for booked calls)
- Backward compatible: existing transcriptions show intent as "not available"
- Minimal additional AI cost: same API call, slightly larger response (~50 extra tokens)
- Polling and background processing patterns unchanged

