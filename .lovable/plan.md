# KPI Hierarchy Refinement — Primary Metrics

## Goal
Introduce a subtle `variant` prop on the inline KPI component so "Auto-pay Enrolled" and "Pay-cycle Misalignment" read as primary operational metrics without breaking the restrained PadSplit visual system.

## Scope
**Single file:** `src/components/payment-experience/PaymentExperienceInsightsDashboard.tsx`  
**No logic, analytics, hooks, queries, or routing changes.**

---

## Changes

### 1. KPI component — add `variant` prop
```ts
interface KPIProps {
  // existing fields…
  variant?: 'default' | 'primary';
}
```
- `variant = 'default'` keeps existing rendering exactly.
- `variant = 'primary'` applies the emphasis treatments below.

### 2. Primary variant styling (`variant === 'primary'`)

**Card wrapper**
- Add `relative` + `overflow-hidden` for the `::before` accent line.
- Add subtle border emphasis: `border-slate-300/80 dark:border-slate-700`.
- Add faint top accent line:
  ```
  before:absolute before:top-0 before:left-0 before:right-0 before:h-[2px] before:rounded-t-xl
  ```
- Accent tint on `::before`:
  - Auto-pay Enrollment → `before:bg-green-500/60`
  - Pay-cycle Misalignment → `before:bg-orange-500/60`

**Value typography**
- Desktop only (`md:`): `text-[3.4rem] leading-none`.
- Mobile stays unchanged.

**Label**
- `text-foreground/80` instead of `text-muted-foreground uppercase`.

**Caption / meta insight line**
- Convert to intentional operational annotation style:
  ```
  text-[12px] italic text-muted-foreground/90
  ```
  (applies only when `caption` is present).

**Icon container**
- Slightly stronger background tint (no size change):
  - Auto-pay Enrollment → `bg-green-50 dark:bg-green-950/20`
  - Pay-cycle Misalignment → `bg-orange-50 dark:bg-orange-950/20`

### 3. Grid update
- Update the KPI grid class to exactly:
  ```
  grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3
  ```
- No masonry, no asymmetric layout, no card reordering.

### 4. Instance wiring
- Wire `Auto-pay Enrolled` instance with `variant="primary"` and green accent classes.
- Wire `Pay-cycle Misalignment` instance with `variant="primary"` and orange accent classes.

---

## Guardrails
- No new dependencies.
- No changes to analytics, formulas, hooks, or data flow.
- Maintain AA contrast and semantic structure.
- No meaning conveyed by color alone (accent line + label/value changes provide hierarchy).
- All existing spacing and padding rhythm preserved.

## Acceptance
- Auto-pay Enrolled and Pay-cycle Misalignment feel subtly more prominent.
- Dashboard remains restrained, executive-friendly, and mobile-stable.
- No TypeScript errors. No layout shift on resize.
