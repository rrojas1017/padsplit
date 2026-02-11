

# Add Sub-Categories and Actionable Solutions to All Insight Sections

## Problem
Payment Insights, Transportation Insights, and Move-In Barriers currently show flat, single-level data without the granular sub-category breakdowns and actionable solutions that General Pain Points now have.

## Solution
Apply the same sub-category + solution pattern to all three remaining sections, in both the AI prompt and the frontend UI.

## Changes

### 1. Edge Function (`analyze-member-insights/index.ts`) -- Enhanced Prompt Schema

Update the three schema sections in the AI prompt:

**Payment Insights** -- add `sub_categories` and `actionable_solutions`:
```json
"payment_insights": [
  {
    "insight": "Members confused about total move-in costs",
    "frequency": 15,
    "impact": "high",
    "examples": ["quote"],
    "sub_categories": [
      {
        "name": "Deposit vs First Week",
        "frequency": 45,
        "description": "Members don't understand deposit is separate from first week payment",
        "examples": ["quote"],
        "solution": { "action": "...", "owner": "Product", "effort": "low", "expected_outcome": "..." }
      }
    ],
    "actionable_solutions": [
      { "action": "...", "owner": "Training", "effort": "low", "expected_outcome": "..." }
    ]
  }
]
```

**Transportation Insights** -- add `sub_categories` and `actionable_solutions`:
```json
"transportation_insights": [
  {
    "insight": "Members need public transit access",
    "frequency": 12,
    "markets_affected": ["Atlanta"],
    "examples": ["quote"],
    "sub_categories": [
      {
        "name": "Bus Route Proximity",
        "frequency": 50,
        "description": "...",
        "examples": ["quote"],
        "solution": { "action": "...", "owner": "Product", "effort": "medium", "expected_outcome": "..." }
      }
    ],
    "actionable_solutions": [...]
  }
]
```

**Move-In Barriers** -- add `sub_categories` and `actionable_solutions`:
```json
"move_in_barriers": [
  {
    "barrier": "Financial readiness",
    "frequency": 10,
    "impact_score": 8,
    "resolution": "...",
    "examples": ["quote"],
    "sub_categories": [
      {
        "name": "Insufficient funds for deposit",
        "frequency": 40,
        "description": "...",
        "examples": ["quote"],
        "solution": { "action": "...", "owner": "Operations", "effort": "medium", "expected_outcome": "..." }
      }
    ],
    "actionable_solutions": [...]
  }
]
```

Add prompt instructions similar to pain points:
- "For any payment_insight, transportation_insight, or move_in_barrier with frequency >= 15%, break it into 2-5 sub_categories"
- "Each sub_category MUST include a practical solution with owner, effort, and expected_outcome"

### 2. Frontend (`PainPointsPanel.tsx`) -- Enhanced UI for All Three Sections

Update the interfaces to include the new optional fields:

```typescript
interface PaymentInsight {
  insight: string;
  frequency: number;
  impact: string;
  examples?: string[];
  sub_categories?: PainPointSubCategory[];       // NEW
  actionable_solutions?: PainPointSolution[];     // NEW
}

interface TransportationInsight {
  insight: string;
  frequency: number;
  markets_affected?: string[];
  examples?: string[];
  sub_categories?: PainPointSubCategory[];       // NEW
  actionable_solutions?: PainPointSolution[];     // NEW
}

interface MoveInBarrier {
  barrier: string;
  frequency: number;
  impact_score: number;
  resolution?: string;
  examples?: string[];
  sub_categories?: PainPointSubCategory[];       // NEW
  actionable_solutions?: PainPointSolution[];     // NEW
}
```

Add `<SubCategoriesSection>` and `<ActionableSolutionsSection>` (already existing components) to each of the three accordion sections, reusing the same drill-down UI pattern from General Pain Points.

### Backward Compatibility
- All new fields are optional, so existing stored analyses render exactly as before
- Only new analyses (run after this change) will include the enhanced data
- No database migration needed -- data is stored as JSONB

## Files Changed
- `supabase/functions/analyze-member-insights/index.ts` -- enhance prompt schema for payment_insights, transportation_insights, and move_in_barriers
- `src/components/member-insights/PainPointsPanel.tsx` -- extend interfaces and add sub-category/solution components to all three sections

