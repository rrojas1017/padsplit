

# Add Average Weekly Budget to Market Intelligence Cards

## Overview
Display the average weekly budget per state in the summary cards at the top, and add it to each market comparison card for the Top 10 Markets.

## Changes

### 1. `src/hooks/useMarketIntelligence.ts`
- Compute a new `systemAvgBudget` value from `stateData`, averaging all non-null `avgWeeklyBudget` values across states.
- Return `systemAvgBudget` from the hook.

### 2. `src/pages/MarketIntelligence.tsx`
- Add a 5th summary card titled **"Avg Weekly Budget"** showing the system-wide average formatted as currency (e.g., `$185`).
- Update the summary grid from `grid-cols-4` to `grid-cols-5` on medium+ screens.
- Pass `systemAvgBudget` down to `MarketComparisonCards`.

### 3. `src/components/market-intelligence/MarketComparisonCards.tsx`
- Accept `systemAvgBudget` as a new prop.
- Add a budget line to each Top 10 market card showing that city's `avgWeeklyBudget` (e.g., `$180/wk`), with color coding:
  - Green if above system average
  - Red if below system average
  - Gray if no data available

### 4. `src/components/market-intelligence/StateHeatTable.tsx`
- Add an **"Avg Budget"** sortable column to the state table.
- Display formatted currency or an em-dash if null.
- Add `avgWeeklyBudget` to the `SortKey` type.

No backend changes needed -- `avgWeeklyBudget` is already computed and returned by the `aggregate-market-data` function.

