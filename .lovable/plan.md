

# Fix Agent Breakdown in Non-Booking Analysis

## Problem Identified

The current implementation correctly collects agent data from the database (all 7 agents), but the AI model is only returning a subset (1 agent: Abdul) in its `agent_breakdown` response.

**Expected vs Actual:**

| Agent | Actual Records | AI Returned |
|-------|---------------|-------------|
| Megane | 27 | Missing |
| Abdullah | 15 | 15 (as "Abdul") |
| Anel | 11 | Missing |
| Win | 8 | Missing |
| Paul E. | 5 | Missing |
| Christine Joy Serra | 2 | Missing |
| John Mosquera | 2 | Missing |

## Root Cause

The AI prompt in `analyze-non-booking-insights/index.ts` does not enforce that **all agents** must be included in the response. The AI is interpreting this as optional summarization.

## Solution

Update the edge function to:

1. **Pre-compute the agent breakdown** server-side instead of relying on AI to preserve this data
2. **Only ask AI for analytical insights** (improvement areas, top objections interpretation)
3. **Merge server-computed counts with AI-generated insights**

This ensures:
- Agent counts are always accurate (computed from source data)
- AI still provides qualitative analysis per agent
- No data loss from AI summarization

---

## Implementation

### File: `supabase/functions/analyze-non-booking-insights/index.ts`

**Changes:**

1. **Store computed agent data directly** instead of relying on AI to return it:

```typescript
// Current: AI returns agent_breakdown
// New: Compute agent_breakdown directly from agentData

const computedAgentBreakdown: Record<string, any> = {};
for (const [agentName, data] of Object.entries(agentData)) {
  computedAgentBreakdown[agentName] = {
    non_booking_count: data.nonBookingCount,
    top_objection: data.objections[0] || 'none',
    top_concern: data.concerns[0] || 'none'
  };
}
```

2. **Update AI prompt** to only ask for analytical insights per agent (not counts):

```typescript
// In AI prompt, change agent_breakdown section:
"agent_insights": {
  "AgentName": {
    "improvement_area": "Specific coaching recommendation",
    "pattern_observation": "Qualitative insight about this agent's calls"
  }
}
```

3. **Merge computed data with AI insights** before saving:

```typescript
// Merge computed counts with AI insights
const finalAgentBreakdown: Record<string, any> = {};
for (const [agentName, data] of Object.entries(computedAgentBreakdown)) {
  const aiInsight = parsedAnalysis.agent_insights?.[agentName] || {};
  finalAgentBreakdown[agentName] = {
    ...data,
    improvement_area: aiInsight.improvement_area || 'Review call recordings for coaching opportunities',
    pattern_observation: aiInsight.pattern_observation || null
  };
}
```

4. **Save merged data** to the database:

```typescript
agent_breakdown: finalAgentBreakdown, // Use merged data, not AI-only
```

---

## Updated Agent Breakdown Structure

After the fix, `agent_breakdown` will contain:

```json
{
  "Megane": {
    "non_booking_count": 27,
    "top_objection": "Voicemail - member didn't answer",
    "top_concern": "Pricing concerns",
    "improvement_area": "AI-generated coaching tip",
    "pattern_observation": "AI-generated pattern"
  },
  "Abdullah": {
    "non_booking_count": 15,
    "top_objection": "timing issues",
    "top_concern": "busy at time of call",
    "improvement_area": "Proactive callback scheduling",
    "pattern_observation": "..."
  },
  // ... all 7 agents
}
```

---

## Frontend Enhancement (Optional)

Update the Agent Breakdown card in `NonBookingAnalysisTab.tsx` to show more details:

- Show all agents (currently limited to 4 with `.slice(0, 4)`)
- Add improvement areas from AI analysis
- Sort by non_booking_count descending

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/analyze-non-booking-insights/index.ts` | Compute agent data server-side, merge with AI insights |
| `src/components/call-insights/NonBookingAnalysisTab.tsx` | Improve agent breakdown display (show all agents, add scrolling) |

---

## Technical Notes

- This pattern separates **factual data** (counts from database) from **analytical insights** (AI interpretation)
- Prevents AI from dropping or misinterpreting numerical data
- Same approach should be applied to `market_breakdown` for consistency
- No database migration needed - uses existing `agent_breakdown` JSONB column

