

# Add Customer Journey Suggestions Section

## Overview

Add a new section at the bottom of the Booking Insights tab that synthesizes all analyzed variables (pain points, objections, sentiment, market data, barriers) into **real-life customer journey scenarios** with actionable intervention points.

## What It Will Look Like

```text
┌──────────────────────────────────────────────────────────────────────┐
│ 🗺️ Real-Life Customer Journeys                                      │
│    Based on patterns from 635 analyzed communications               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  THE URGENT RELOCATOR (28% of members)                              │
│  ─────────────────────────────────────────                          │
│  📍 "I need to move by Friday"                                      │
│                                                                      │
│  Journey:                                                            │
│  ┌─────────┐    ┌─────────────┐    ┌────────────┐    ┌─────────┐   │
│  │ Crisis  │ →  │ Quick Search│ →  │ Payment    │ →  │ Booking │   │
│  │ Trigger │    │ (Same Day)  │    │ Confusion  │    │ or Drop │   │
│  └─────────┘    └─────────────┘    └────────────┘    └─────────┘   │
│                                                                      │
│  🚩 Intervention Points:                                             │
│  • Show "Move-in ASAP" filter prominently                           │
│  • Display total cost upfront on listing cards                      │
│  • Enable same-day host approval for verified hosts                 │
│                                                                      │
│  💬 Actual member quote: "I'm getting evicted and need somewhere    │
│     by end of week"                                                  │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  THE SKEPTICAL COMPARER (22% of members)                            │
│  ─────────────────────────────────────────                          │
│  📍 "How is this different from Craigslist?"                        │
│                                                                      │
│  Journey:                                                            │
│  ┌─────────┐    ┌─────────────┐    ┌────────────┐    ┌─────────┐   │
│  │ Multiple│ →  │ Trust       │ →  │ Sight      │ →  │ Agent   │   │
│  │ Options │    │ Questions   │    │ Unseen Fear│    │ Reassure│   │
│  └─────────┘    └─────────────┘    └────────────┘    └─────────┘   │
│                                                                      │
│  🚩 Intervention Points:                                             │
│  • Add video tours and verified photos                              │
│  • Show "What makes PadSplit different" comparison                  │
│  • Offer virtual walkthroughs with hosts                            │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Data Sources for Journey Generation

The AI will synthesize journeys from:

| Data Source | Usage |
|-------------|-------|
| `pain_points` | Primary friction moments in journey |
| `objection_patterns` | Trust/fear barriers at decision points |
| `move_in_barriers` | What blocks final conversion |
| `member_journey_insights` | Repeat caller patterns, timing |
| `sentiment_distribution` | Emotional state indicators |
| `market_breakdown` | Regional variations |
| `payment_insights` | Financial friction points |
| `transportation_insights` | Practical logistics concerns |

## Implementation Approach

### Option A: Pre-Generated Journeys (Recommended)

Add journey generation to the existing AI analysis in `analyze-member-insights`. The AI already has all context - we add one more output section:

```json
"customer_journeys": [
  {
    "persona_name": "The Urgent Relocator",
    "frequency_percent": 28,
    "trigger_quote": "I need to move by Friday",
    "journey_stages": [
      { "stage": "Crisis Trigger", "emotion": "stressed", "action": "emergency search" },
      { "stage": "Quick Search", "emotion": "anxious", "friction": "too many options" },
      { "stage": "Payment Confusion", "emotion": "frustrated", "friction": "unclear fees" },
      { "stage": "Decision Point", "emotion": "hesitant", "outcome": "booking or drop" }
    ],
    "intervention_points": [
      "Show 'Move-in ASAP' filter prominently",
      "Display total cost upfront on listing cards"
    ],
    "example_quotes": ["I'm getting evicted...", "My landlord gave me 5 days..."],
    "related_pain_points": ["Payment & Fee Confusion", "Booking Process"],
    "market_concentration": { "Atlanta": 35, "Dallas": 25 }
  }
]
```

### Database Change

Add new column to `member_insights` table:

```sql
ALTER TABLE member_insights ADD COLUMN customer_journeys JSONB DEFAULT '[]';
```

### Files to Modify

| File | Changes |
|------|---------|
| Database Migration | Add `customer_journeys` column |
| `supabase/functions/analyze-member-insights/index.ts` | Add journey generation to AI prompt, store in new column |
| New: `src/components/member-insights/CustomerJourneyPanel.tsx` | Visual journey component with stages, quotes, interventions |
| `src/components/call-insights/BookingInsightsTab.tsx` | Import and render CustomerJourneyPanel at bottom |

## UI Component Design

### CustomerJourneyPanel Features

1. **Persona Cards**: Each journey as an expandable card with:
   - Persona name and icon (e.g., clock for urgent, magnifier for skeptical)
   - Frequency badge (e.g., "28% of members")
   - Trigger quote in italics

2. **Journey Timeline**: Horizontal flow showing:
   - Stage name
   - Emotional state indicator (color-coded)
   - Friction point (if any)

3. **Intervention Suggestions**: Actionable bullets with:
   - Clear owner (Marketing, Product, Training)
   - Priority indicator

4. **Evidence Section**: Collapsible with:
   - Related pain points (linked to PainPointsPanel)
   - Actual member quotes
   - Market distribution

## Suggested Persona Types (AI Will Generate)

Based on the existing data patterns:

| Persona | Trigger | Primary Friction | Key Intervention |
|---------|---------|------------------|------------------|
| The Urgent Relocator | Housing crisis | Speed of approval | Same-day booking options |
| The Budget Calculator | Paycheck timing | Fee transparency | Total cost calculator |
| The Denied & Trying Again | Previous rejection | Trust rebuild | Clear denial reasons |
| The Skeptical First-Timer | New to shared living | Sight unseen fear | Video tours |
| The Transit-Dependent | No car | Location to bus | Commute time filter |
| The Comparison Shopper | Multiple listings | Decision paralysis | Side-by-side compare |

## Technical Notes

- Journey generation uses the same AI call (Gemini 2.5 Pro) - just extending the prompt
- No additional API costs beyond current analysis
- Journeys will evolve as new data is analyzed
- Each journey links back to source pain points for drill-down

