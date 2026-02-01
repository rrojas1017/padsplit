

# Enable Non-Booking Analysis for 70 Transcribed Records

## Overview

Create a Non-Booking specific analysis pipeline that mirrors the existing Booking Insights pattern but focuses on understanding why members didn't convert. This will analyze the 70 currently transcribed Non-Booking records.

---

## Current State

| Metric | Value |
|--------|-------|
| Total Non-Booking Records | 3,286 |
| Transcribed with call_key_points | 70 |
| Available data per record | concerns, objections, sentiment, readiness, summary |

Sample data shows rich insights including:
- Reasons for not booking ("shared living model doesn't meet needs", "found an apartment")
- Sentiment breakdown (positive/neutral/negative)
- Move-in readiness levels (high/medium/low)
- Recommended follow-up actions

---

## Implementation

### Phase 1: Database Schema

Create a `non_booking_insights` table to store aggregated analysis results:

```text
non_booking_insights
+-- id (uuid, primary key)
+-- analysis_period (text)
+-- date_range_start (date)
+-- date_range_end (date)
+-- total_calls_analyzed (integer)
+-- rejection_reasons (jsonb)         -- categorized reasons they didn't book
+-- missed_opportunities (jsonb)      -- high-readiness non-bookers
+-- sentiment_distribution (jsonb)    -- positive/neutral/negative breakdown
+-- objection_patterns (jsonb)        -- common hesitations with responses
+-- recovery_recommendations (jsonb)  -- AI-generated strategies
+-- agent_breakdown (jsonb)           -- per-agent non-booking stats
+-- market_breakdown (jsonb)          -- geographic patterns
+-- trend_comparison (jsonb)          -- vs previous period
+-- avg_call_duration_seconds (numeric)
+-- raw_analysis (text)
+-- status (text)                     -- processing/completed/failed
+-- error_message (text)
+-- created_at (timestamptz)
+-- created_by (uuid)
```

### Phase 2: Edge Function

Create `analyze-non-booking-insights` edge function following the existing background processing pattern:

**Data Collection:**
1. Query `bookings` where `status = 'Non Booking'` and `transcription_status = 'completed'`
2. Join with `booking_transcriptions` to get `call_key_points`
3. Aggregate concerns, objections, sentiment, readiness scores

**AI Analysis Focus (Non-Booking Specific Prompt):**
- Why didn't they book? (categorize rejection reasons)
- What objections came up? (with suggested responses)
- Which were missed opportunities? (high readiness but didn't convert)
- Recovery recommendations by pattern
- Agent performance breakdown

**Processing Pattern:**
- Use `EdgeRuntime.waitUntil()` for background processing
- Return immediate "processing" response with insight ID
- Update status to "completed" when done

### Phase 3: Frontend Integration

**File: NonBookingAnalysisTab.tsx**
1. Enable "Run Analysis" button (remove disabled state and tooltip)
2. Add state management for `isAnalyzing` and `selectedInsight`
3. Create `useNonBookingInsightsPolling` hook (similar to member insights)
4. Wire up edge function invocation
5. Add previous analyses selector dropdown
6. Pass real data to child components

**File: NonBookingReasonsChart.tsx**
- Accept `reasons` prop from parent
- Display real rejection reasons with percentages
- Remove placeholder state when data exists

**File: NonBookingSentimentChart.tsx**
- Accept `sentiment` prop from parent
- Show actual positive/neutral/negative distribution

**File: NonBookingMissedOpportunitiesPanel.tsx**
- Accept `missedOpportunities` prop with details
- Show recoverable opportunities with suggestions

**File: NonBookingRecommendationsPanel.tsx**
- Accept AI-generated recovery strategies
- Display actionable items with priority badges

---

## AI Prompt Design

The edge function will use a specialized prompt for Non-Booking analysis:

```text
You are analyzing PadSplit calls that DID NOT result in a booking.
Your goal is to understand why members didn't convert and identify recovery opportunities.

CONTEXT: PadSplit offers affordable room rentals with shared living.
These are calls where the member did NOT book a room.

DATA FROM [X] NON-BOOKING CALLS:
- Concerns: [aggregated from call_key_points.memberConcerns]
- Objections: [aggregated from call_key_points.objections]
- Sentiment breakdown: [counts]
- Readiness breakdown: [counts]

ANALYZE AND RETURN:
{
  "rejection_reasons": [
    {"reason": "Product-Market Mismatch", "percentage": 35, 
     "examples": ["Looking for whole apartment", "Don't want roommates"]}
  ],
  "missed_opportunities": [
    {"pattern": "High readiness but no availability", 
     "count": 12, "recovery_suggestion": "Follow up when units open"}
  ],
  "objection_patterns": [
    {"objection": "Pricing concerns", "frequency": 15,
     "suggested_response": "Emphasize weekly payment flexibility"}
  ],
  "recovery_recommendations": [
    {"recommendation": "24-hour follow-up for voicemails",
     "priority": "high", "category": "Process", 
     "expected_impact": "Could recover 15% of non-bookers"}
  ],
  "agent_breakdown": {
    "Abdul": {"non_booking_rate": 12, "common_objection": "timing"}
  }
}
```

---

## File Changes Summary

| File | Action |
|------|--------|
| `supabase/migrations/xxx_create_non_booking_insights.sql` | Create table + RLS |
| `supabase/functions/analyze-non-booking-insights/index.ts` | New edge function |
| `supabase/config.toml` | Add function config |
| `src/hooks/useNonBookingInsightsPolling.ts` | New polling hook |
| `src/components/call-insights/NonBookingAnalysisTab.tsx` | Enable analysis, wire data |
| `src/components/call-insights/NonBookingReasonsChart.tsx` | Accept real data |
| `src/components/call-insights/NonBookingSentimentChart.tsx` | Accept real data |
| `src/components/call-insights/NonBookingMissedOpportunitiesPanel.tsx` | Accept detailed data |
| `src/components/call-insights/NonBookingRecommendationsPanel.tsx` | Accept recommendations |

---

## Expected Output

After running analysis on the 70 transcribed Non-Booking calls:

**Rejection Reasons Chart:**
- Product-Market Mismatch (e.g., "wanted whole apartment")
- Timing Issues (e.g., "busy, call back later")
- Already Found Housing
- Pricing Concerns
- Availability Issues

**Missed Opportunities Panel:**
- High-readiness non-bookers with recovery suggestions
- Voicemail patterns with follow-up recommendations

**Recommendations Panel:**
- AI-generated recovery strategies
- Priority-ranked action items
- Expected impact estimates

---

## Processing Estimate

| Step | Time |
|------|------|
| Data aggregation (70 records) | ~1 second |
| AI analysis (Gemini 2.5 Pro) | ~15-30 seconds |
| Database update | ~1 second |
| **Total** | ~30 seconds |

**Cost:** ~$0.02 per analysis run

