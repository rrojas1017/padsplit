

# More Precise Pain Points with Sub-Categories and Actionable Solutions

## Problem
The AI currently groups all payment-related concerns under a single "Payment & Fee Confusion" category at 68%. This is too vague to act on -- it could mean members don't understand the deposit, the weekly rate, the move-in total, platform fees, or refund policies. All of these require different solutions.

## Solution
Enhance the AI prompt to require **sub-category breakdowns** for any pain point above 20% frequency, and add a new **"actionable_solutions"** field with concrete, real-life fixes per sub-issue. The UI will then display these sub-categories as expandable drill-downs within each pain point.

## Changes

### 1. Edge Function (`analyze-member-insights/index.ts`) -- Enhanced Prompt

Update the `pain_points` schema in the AI prompt to require:

- **`sub_categories`**: When a pain point has 20%+ frequency, break it into 2-5 specific sub-issues with their own frequencies, descriptions, and quotes
- **`actionable_solutions`**: For each pain point (and sub-category), include a concrete operational solution with owner (Product, Training, Marketing, Operations) and effort level

Updated pain_points schema in the prompt:
```json
"pain_points": [
  {
    "category": "Payment & Fee Confusion",
    "description": "Members struggle with understanding total costs",
    "frequency": 68,
    "examples": ["verbatim quote"],
    "market_breakdown": {"Atlanta, GA": 70, "Dallas, TX": 60},
    "sub_categories": [
      {
        "name": "Move-In Cost Breakdown",
        "frequency": 35,
        "description": "Members don't understand what the total move-in cost includes (deposit + first week + platform fee)",
        "examples": ["How much do I need total to move in?", "Why is it more than the weekly rate?"],
        "solution": {
          "action": "Add a visual cost calculator on every listing showing deposit + first week + fees as separate line items",
          "owner": "Product",
          "effort": "medium",
          "expected_outcome": "Reduce payment-related call volume by ~30%"
        }
      },
      {
        "name": "Weekly vs Monthly Pricing",
        "frequency": 20,
        "description": "Members compare PadSplit weekly rates to monthly rents elsewhere and get confused",
        "examples": ["So $185 a week, that's like $740 a month?"],
        "solution": {
          "action": "Show both weekly and monthly-equivalent pricing on listings with a comparison tooltip",
          "owner": "Product",
          "effort": "low",
          "expected_outcome": "Improve price clarity for budget-conscious members"
        }
      }
    ],
    "actionable_solutions": [
      {
        "action": "Create a standardized 'Total Move-In Cost' breakdown graphic for agents to send via SMS",
        "owner": "Training",
        "effort": "low",
        "expected_outcome": "Agents can proactively address the #1 concern before it becomes an objection"
      }
    ]
  }
]
```

Add explicit prompt instructions:
- "For any pain point with frequency >= 20%, you MUST break it into 2-5 specific sub_categories with their own frequencies (as percentages of the parent category's calls)"
- "Each sub_category MUST include a practical solution with owner, effort, and expected_outcome"
- "Sub-category frequencies should sum to approximately 100% of the parent category"

### 2. Frontend (`PainPointsPanel.tsx`) -- Sub-Category Drill-Down UI

Add a new expandable section within each pain point card:

- When a pain point has `sub_categories`, show a "View Breakdown" button
- Expanding reveals each sub-issue as a mini card with:
  - Sub-category name + its own frequency bar (relative to parent)
  - Description explaining the specific issue
  - Verbatim quotes
  - Solution card with action, owner badge, effort badge, and expected outcome
- The top-level `actionable_solutions` display as a highlighted "Recommended Actions" section at the bottom of the pain point

### 3. Types Update

Add new interfaces:
```typescript
interface PainPointSolution {
  action: string;
  owner: 'Product' | 'Training' | 'Marketing' | 'Operations';
  effort: 'low' | 'medium' | 'high';
  expected_outcome: string;
}

interface PainPointSubCategory {
  name: string;
  frequency: number;
  description: string;
  examples?: string[];
  solution?: PainPointSolution;
}
```

Extend the existing `PainPoint` interface with:
- `sub_categories?: PainPointSubCategory[]`
- `actionable_solutions?: PainPointSolution[]`

## Technical Details

### Files Changed
- `supabase/functions/analyze-member-insights/index.ts` -- enhance AI prompt with sub-category and solution requirements
- `src/components/member-insights/PainPointsPanel.tsx` -- add sub-category drill-down UI and solution cards

### Backward Compatibility
- `sub_categories` and `actionable_solutions` are optional fields, so existing stored analyses will render exactly as they do today
- Only new analyses (run after this change) will include the enhanced data
- No database migration needed -- the data is stored as JSONB in the existing `pain_points` column

