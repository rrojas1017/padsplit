## Refine Payment Experience KPI metadata

Single-file copy refinement in `src/components/payment-experience/PaymentExperienceInsightsDashboard.tsx`. No hook, query, calculation, layout, or component changes.

### Approach

Each `<KPI />` currently renders two metadata lines (`denominator` + `meta`). Replace with a single, human-readable line per card by passing only `denominator` (keeping the existing slot and styling) and omitting `meta`.

Helpers used inline (no new components, no new utilities):
- `kpis.literacy.numerator` → 148
- `kpis.autopayEnrolled.numerator` → 29
- `kpis.moveInClarity.numerator` → 47
- `kpis.hardshipAware.numerator` / `.denominator` → 66 / 112
- `kpis.payCycleMisalignment.numerator` → 91
- `records.length` → 178

### Per-card changes

| Card | New single metadata line |
|---|---|
| Members Surveyed | `{records.length} surveyed` |
| Avg Payment Literacy | `Based on {literacy.numerator} responses` |
| Auto-pay Enrolled | `{autopayEnrolled.numerator} enrolled members` |
| Move-in Cost Clarity | `{moveInClarity.numerator} member ratings` |
| Hardship-Aware | `{hardshipAware.numerator} of {hardshipAware.denominator} aware` |
| Pay-cycle Misalignment | `{payCycleMisalignment.numerator} non-weekly schedules` |

### Implementation notes

- Remove `membersDenom` local var; pass the new string directly.
- Drop the `meta` prop on all six KPI cards.
- Leave `KPI` component definition unchanged — `meta` is already optional, and the `min-h-[40px]` reservation in the metadata block stays so card heights remain consistent across the grid.
- Keep AI banner, Member Insights cards, Eligibility card, loading/empty states untouched.
- Values, icons, colors, spacing, typography, responsive grid, and the upstream selector remain identical.
