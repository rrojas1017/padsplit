# Payment Experience Insights — Tab Polish Pass

Premium-polish refinement of the existing analytical tab architecture. No new analytics, queries, charts, routes, or copy changes beyond a small Actions-tab intro line.

## 1. Tab strip hierarchy (`InsightTabs.tsx`)

Refine the underline strip to feel more intentional without becoming loud.

- `TRIGGER_CLASS` updates:
  - Padding: `px-4 py-2.5` → `px-5 py-3`
  - Inactive: keep `text-muted-foreground font-medium`
  - Active: bump from `font-medium` to `font-semibold` and `text-foreground`
  - Keep: `border-b-2 border-transparent`, `data-[state=active]:border-primary`, `bg-transparent`, `rounded-none`, `shadow-none`, `whitespace-nowrap`
- `TabsList`: add `mb-1` and keep `border-b border-border bg-transparent p-0 h-auto overflow-x-auto rounded-none`
- Outer wrapper around `<Tabs>` gets `mt-1` so the strip has a touch more breathing room from the funnel above without being floaty.

## 2. Vertical rhythm tightening

- `InsightTabs.tsx`: `<TabsContent className="mt-3">` → `mt-2` (4 places). Combined with the tab strip `mb-1`, this saves ~8–12px between strip and content while preserving readability.
- Each tab body keeps `space-y-3`. No other spacing changes anywhere else in the dashboard.

## 3. Overview tab — Insight Snapshot strip (`OverviewTab.tsx`)

Add a compact 3-column "Insight Snapshot" row between the `Member Insights` header and `Top Emerging Risks`. Reuses already-derived data only.

- New component co-located in the tab file: `InsightSnapshot` (small, presentational).
- Props extended on `OverviewTab`: add `autopayBarriers`, `segments`, `keyDrivers` (all already computed upstream — wire them through `InsightTabs.tsx`).
- Three muted snapshot cells, each `rounded-md border border-border/60 bg-muted/30 px-3 py-2`:
  - **Top Barrier** — `autopayBarriers[0]?.label` + `count · share%` muted helper. Fallback: "Not enough data."
  - **Top At-Risk Segment** — from `segments.find(s => s.id === 'autopay-by-cadence')`: pick the row with the lowest `percent` (auto-pay enrollment) — label = `row.label`, helper = `row.display`. Fallback: "Not enough data."
  - **Top Driver** — `keyDrivers[0]?.headline` truncated to 2 lines (`line-clamp-2`); helper = `N={keyDrivers[0].n}`. Fallback: "Not enough data."
- Layout: `grid grid-cols-1 sm:grid-cols-3 gap-2`. Each cell uses uppercase muted label (`text-[10px] tracking-wide text-muted-foreground/80 uppercase`), then `text-sm font-medium text-foreground line-clamp-2`, then `text-[11px] text-muted-foreground/70 tabular-nums`.
- Hidden entirely if all three sources are empty (no strip rendered at all).
- Reuses existing analytics outputs — no new computation, no new types, no new utils.

## 4. Drivers & Friction density (`DriversTab.tsx` + `visuals/RankedBarList.tsx`)

Lighten the visual footprint without shrinking type.

- `RankedBarList.tsx` (already used by Auto-pay Barriers):
  - Reduce row vertical spacing: `space-y-3` → `space-y-2` on the list root
  - Tighten detail text: `leading-snug` → `leading-tight` on the optional `detail` line, and reduce its top margin (e.g. `mt-1` → `mt-0.5`)
  - Keep bar thickness, label size, count size, and quote/detail separation unchanged
- No edits to the Payment Friction Summary card or `KeyDriversSection`.

If `RankedBarList` is also used inside Overview Insight Snapshot data, it isn't — snapshot reads raw barrier objects only, so the spacing change is isolated to Drivers tab visually.

## 5. Actions tab framing (`ActionsTab.tsx`)

Add a single muted intro line under the section header, before `SuggestedActionsSection`.

- Rendered only when `actions.length > 0` (don't double up with empty state).
- Markup: `<p className="text-xs text-muted-foreground leading-snug max-w-prose">Recommended operational actions prioritized by estimated reach, member impact, and friction severity.</p>`
- No card, no callout, no icon, no border.

## 6. Wiring

- `InsightTabs.tsx`: pass `autopayBarriers`, `segments`, `keyDrivers` to `<OverviewTab />` in addition to current props. No new derivations — all already received as props from the dashboard.

## Mobile (375 / 390 / 414)

- Tab strip still horizontally scrolls; new padding stays within row.
- Insight Snapshot collapses to single column via `grid-cols-1 sm:grid-cols-3`.
- `mt-2` content spacing remains readable on small screens.
- No new overflow risks.

## Out of scope

- No new analytics, queries, charts, or chart libraries
- No routing or URL state
- No Executive Summary, KPI, or Funnel changes
- No new primitives
- No motion/animation
- No changes to `EmergingRisksSection`, `KeyDriversSection`, `SegmentedInsightsSection`, `SuggestedActionsSection` internals
- No copy changes other than the single Actions intro sentence and snapshot labels

## Files touched

- `src/components/payment-experience/insights/InsightTabs.tsx` — trigger styling, content spacing, wire new Overview props
- `src/components/payment-experience/insights/tabs/OverviewTab.tsx` — add Insight Snapshot, extend props
- `src/components/payment-experience/insights/tabs/DriversTab.tsx` — none (changes happen in shared visual)
- `src/components/payment-experience/insights/tabs/ActionsTab.tsx` — add muted intro line
- `src/components/payment-experience/insights/visuals/RankedBarList.tsx` — tighten row + detail spacing

## Acceptance check

Tab strip reads as more authoritative (semibold active + roomier padding) but still restrained; spacing between funnel/tabs/content feels ~8–12px tighter; Overview gains a 3-up snapshot strip that uses only existing data; Drivers' Auto-pay Barriers list is visibly lighter; Actions tab has a short muted framing sentence; no TS errors; no analytics regression; mobile layouts stack cleanly with no overflow.
