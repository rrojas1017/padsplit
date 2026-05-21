
# Payment Experience Dashboard — Premium Polish Refinement

Scope: UI/UX cohesion + hierarchy only. No analytics formula changes, no new queries, no charts, no modals, no Executive Summary headline copy changes.

## 1. KPI contextual microcopy

File: `PaymentExperienceInsightsDashboard.tsx`

Add an optional `caption?: string` prop to the local `KPI` component, rendered as a third line in the existing `mt-auto pt-3` footer area (style: `text-[11px] text-muted-foreground/70 leading-snug break-words`). When absent, layout is unchanged.

Derive captions deterministically inside the existing `useMemo` (no new utility file) using `eligibleRecords` + `normalizeCadence`. New helper `computeKpiCaptions(eligibleRecords)` returns:

- `payCycleCaption`: most common non-weekly cadence bucket among eligible records, e.g. `"Most common among bi-weekly earners"`. Requires ≥ 5 in that bucket; otherwise omit.
- `autopayCaption`: cadence bucket with the lowest enrollment rate (min 10 in bucket, min 2 buckets compared), e.g. `"Enrollment lowest among semi-monthly members"`. Otherwise omit.
- `hardshipCaption`: if `not_enrolled` hardship-unaware share is meaningfully higher than `enrolled` (≥ 10 pp gap, ≥ 10 per side), render `"Awareness lower among non-autopay members"`. Otherwise omit.

Captions are routed to the matching KPI cards. All other KPIs (Members Surveyed, Literacy, Move-in Clarity) get no caption to preserve restraint.

Add helper to `src/utils/paymentExperienceAnalytics.ts` exporting `computeKpiCaptions(eligible): { payCycle?: string; autopay?: string; hardship?: string }`. This is a derivation utility, not a new analytics formula — reuses existing normalizers and `CADENCE_LABELS`.

## 2. Survey Funnel — subtle visibility lift

File: `insights/SurveyFunnelSection.tsx`

- `CardContent`: `p-3` → `p-4`.
- Count: `text-xl` → `text-2xl`, keep `font-semibold tabular-nums`.
- Label: `text-[11px] text-muted-foreground` → `text-[11px] font-medium text-muted-foreground/90 tracking-wide`.
- Separator chevron: `text-muted-foreground/40` → `text-muted-foreground/60`.
- Mobile divider: `border-border/60` → `border-border`.

No height/structure change beyond the small padding bump. Stays single row at `md+`, stacked at mobile.

## 3. Analytics Eligibility → funnel footer metadata

File: `PaymentExperienceInsightsDashboard.tsx` and `insights/SurveyFunnelSection.tsx`

Remove the standalone `Analytics Eligibility` card from the Member Insights grid. Member Insights grid becomes 2 cards (Friction Summary, Auto-pay Barriers); `grid-cols-1 md:grid-cols-2` (drop `lg:grid-cols-3`).

Re-render the same eligibility data as a compact muted footer line inside the Survey Funnel card. Extend `SurveyFunnelSection` with optional props:

```ts
interface FunnelEligibilityMeta {
  eligible: number;
  routedTotal: number;
  excluded: number;
  voicemail: number;
  tooShort: number;
  insufficientExtraction: number;
}
```

Rendered below the funnel row as a single line of inline `·`-separated chips (collapsible to wrap on mobile):

```
{eligible}/{routedTotal} eligible · {excluded} excluded
  · {voicemail} voicemail · {tooShort} too short · {insufficientExtraction} incomplete extraction
```

Each "excluded category" piece is suppressed when its count is 0. When `excluded === 0`, render `All routed responses eligible` instead. Style: `mt-3 pt-2 border-t border-border/60 text-[11px] text-muted-foreground/80 flex flex-wrap gap-x-3 gap-y-1`. Optional `ShieldCheck` icon at start (`w-3 h-3`) to retain the prior signal.

This preserves every existing value, keeps it accessible and transparent, but stops it competing as a peer card.

## 4. Suggested Actions — priority differentiation + single Top Priority

File: `insights/SuggestedActionsSection.tsx`

Existing priority mapping (rank 0 → High impact, 1 → Medium, 2+ → Quick win) stays. Visual treatment per rank:

- **Rank 0 — Top Priority**:
  - Add `border-amber-500/40` (replaces default border) and a slim left accent: `border-l-2 border-l-amber-500/70`.
  - Add a small `"Top Priority"` chip rendered in the card header `rightSlot` ABOVE/before the `High impact` chip. Chip: outline, `text-amber-700 dark:text-amber-400 border-amber-500/40 bg-amber-500/5`, `text-[10px] uppercase tracking-wide h-5 px-1.5`.
- **Rank 1 — Medium impact**:
  - Subtle left edge `border-l-2 border-l-muted-foreground/30`. `Medium impact` chip unchanged.
- **Rank 2+ — Quick win**:
  - No left accent. `Quick win` chip unchanged.

The `Top Priority` chip is the only "single top focus" treatment in the dashboard, derived deterministically from the existing impact-sorted order. It is suppressed when `actions.length === 0` (already the early-return path).

Footer line (`High reach` / `Broad operational impact` / `Targeted improvement`) remains unchanged.

`InsightCard` needs to accept and forward a `className` for the left-border variants — it already does.

## 5. Section rhythm tightening

File: `PaymentExperienceInsightsDashboard.tsx` + primitives

- Outer wrapper stays `space-y-3`.
- Collapse the double blank line between banner and KPI grid (lines 133–135) to a single break.
- Member Insights wrapper: `<div className="pt-1">` → drop the wrapper entirely and use a `<SectionHeader title="Member Insights" />` for visual consistency with all other sections.
- `SectionHeader`: change `pt-1` → `pt-0.5` to compress vertical rhythm between sections.
- Grid gaps: keep `gap-3` (already tight, lower harms breathing).
- `InsightCard` header `pb-1.5` stays.

No mobile breakpoint changes.

## 6. Mobile verification

- KPI captions wrap with `break-words`; KPI footer min-height already accommodates an extra line.
- Survey Funnel still stacks vertically at `< md`; eligibility footer wraps via `flex-wrap`.
- Suggested Actions left-accent borders show identically across breakpoints; chips wrap via header `flex items-center gap-2`.
- Verify at 375 / 390 / 414.

## Files touched

Modified:
- `src/components/payment-experience/PaymentExperienceInsightsDashboard.tsx`
- `src/components/payment-experience/insights/SurveyFunnelSection.tsx`
- `src/components/payment-experience/insights/SuggestedActionsSection.tsx`
- `src/components/payment-experience/insights/primitives/SectionHeader.tsx`
- `src/utils/paymentExperienceAnalytics.ts` (add `computeKpiCaptions` derivation helper only — no existing formula changed)

No changes:
- Executive Summary banner copy/structure
- `ExecutiveSummaryBanner.tsx`
- `KeyDriversSection.tsx`, `EmergingRisksSection.tsx`, `SegmentedInsightsSection.tsx`
- Hooks, queries, types

## Acceptance checks

- Three KPI cards (Pay-cycle, Auto-pay, Hardship) show a single muted caption line when data supports it; otherwise omit cleanly.
- Survey Funnel reads as foundational context: slightly bolder counts, slightly stronger separators, eligibility metadata folded into its footer.
- Member Insights grid no longer contains the Analytics Eligibility card.
- The top Suggested Action shows a `Top Priority` chip + amber left accent; the second shows a subtle neutral left edge; the rest are unaccented.
- Section vertical rhythm feels tighter, no cramped clusters.
- Mobile (375/390/414): no overflow, chips/captions wrap cleanly.
- `tsc` clean.
- Executive Summary headline wording unchanged.
