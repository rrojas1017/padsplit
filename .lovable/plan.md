## Problem

Q10 ("Move-in cost clarity 1–5") renders a tiny histogram where buckets 1–4 look identical because one bucket (5) dominates the data. Today's distribution is **1: 2 · 2: 2 · 3: 4 · 4: 7 · 5: 52**, so when the largest bar fills the column, the four smaller bars compress to a near-invisible sliver and the only label shown is the bucket number.

The visual is correct but unreadable. This is a presentation-only fix in `ScaleDisplay`.

## Approach

Tighten `ScaleDisplay` in `src/components/payment-experience/insights/tabs/ScriptResponsesTab.tsx` so every bucket communicates its value at a glance, even when one bucket dominates.

### Changes

1. **Show counts above every bar.** Render the bucket count just above the bar in tabular numerals. When `count === 0`, render a muted "0" so empty buckets are explicitly readable. Render the percentage in a smaller muted line beneath.
2. **Guarantee minimum bar visibility.** Bars with `count > 0` get a minimum height (e.g. `minHeight: 8px`) so 1–2 responses are still distinguishable from 0. Zero-count buckets render an empty track of fixed full height in `bg-muted/40`, so all five columns share the same baseline footprint.
3. **Use a fixed track per bucket.** Each bucket gets a full-height background track (`bg-muted/40`) with the filled portion painted on top using `bg-foreground/70`. This makes the comparison clearly proportional and gives small values a readable backdrop.
4. **Highlight the modal bucket.** The bucket with the highest count gets `bg-amber-500/80` (consistent with the existing amber accent used in `YesNoPills`) so the user immediately sees which rating dominates.
5. **Taller chart.** Bump the histogram height from `h-20` to `h-28` so micro-bars have more vertical space to register.
6. **Keep legend simple.** Below the bars, keep the existing numeric label (1–5) but render in a slightly stronger color and add a left/right caption pair: "Not clear at all" on 1, "Crystal clear" on 5, only when the question is `move_in_cost_clarity` (scaleMin=1, scaleMax=5).

No changes to derivation, CSV, or any other tab. Pure UI in one component.

### Out of scope

- No changes to `paymentExperienceScriptResponses.ts`, hooks, queries, or other questions.
- No new charting library — CSS-only as today.
- No layout/grid changes outside `ScaleDisplay`.

## Acceptance criteria

- For Q10, each of the five buckets displays its count and percentage clearly, even when buckets 1–4 are tiny relative to bucket 5.
- All five bucket columns share the same full-height track baseline.
- The modal bucket is visually emphasized.
- Q12 (overdue threshold, 0–2000 deciles) renders the same way without regression.
- No TypeScript errors. No regressions to other tabs.