

## Fix Research Insights Dashboard — 5 targeted fixes

### Analysis of real data

From the console logs, the actual data shape is clear. The ExecutiveSummary component **already handles** `key_findings` as a string (line 33 assigns it, line 64 renders it as `{bodyText}` — no `.map()` call). The component IS rendering. The `deriveKPIs` function already checks `addressable_pct` and `avg_preventability_score` — but they're all 0 in the real data.

The real problem: **all KPI values are 0, displaying as "0%" instead of "—"**, making the dashboard look broken.

### Changes

**1. `src/types/research-insights.ts` — deriveKPIs already resilient, no change needed**
The function already checks `addressable_pct`, `avg_preventability_score`, `total_cases` via the fallback chain on lines 193/199/207. The values ARE found — they're just 0.

**2. `src/components/research-insights/InsightsKPIRow.tsx` — Show "—" for zero values**
- Total Cases: if 0, show "—" instead of "0"
- Preventable %: if 0, show "—" instead of "0%"
- Avg Preventability: already shows "—" for 0 (line 47)

**3. `src/components/research-insights/TopActionsTable.tsx` — Add empty state and defensive normalization**
- Normalize each item defensively: fall back `action` from `recommendation`/`description`, `impact` from `rationale`/`expected_impact`
- Add an empty state message when no actions exist after normalization

**4. `src/components/research-insights/ReasonCodeChart.tsx` — No change needed**
Already handles arrays with `pct` fallback (line 46: `d.pct ?? d.percentage ?? 0`). Missing `severity` doesn't break anything — colors come from the fixed COLORS array, not from severity fields.

**5. `src/components/research-insights/ExecutiveSummary.tsx` — No change needed**
Already handles `key_findings` as string (line 33). Already handles long headlines (line 38-40). Already renders the hero banner correctly with the real data shape.

### Summary of actual file changes

| File | Change |
|---|---|
| `InsightsKPIRow.tsx` | Show "—" for 0 values on Total Cases and Preventable % |
| `TopActionsTable.tsx` | Add defensive field normalization + empty state fallback |

2 files changed. The other 3 files (deriveKPIs, ExecutiveSummary, ReasonCodeChart) already handle the real data correctly.

