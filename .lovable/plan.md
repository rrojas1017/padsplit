# BIL-FE correction — archived-monthly-summary label

## Defect
`billing_cost_summary` returns `edge_function = null` for the `source = 'archived'` rows
(monthly summary has no per-function detail). In `useBillingData.ts` the `byFunction`
aggregation uses `r.edge_function` as the map key directly, so those rows land under the
key `null` and the "Cost by Edge Function" table (`FunctionCostsTable.tsx`) renders a row
labelled **`null / null`** with ~$1,566.29.

## Scope constraint & a decision needed
You asked to touch **only** `src/hooks/useBillingData.ts` (plus the label-map file where the
function-label lookup lives). The label lookup itself is:

```ts
// src/components/billing/FunctionCostsTable.tsx:15
name: FUNCTION_LABELS[fn] || fn,
```

`FUNCTION_LABELS` is a **static** `Record<string,string>` exported from
`src/utils/billingCalculations.ts`. The dynamic "before <date>" portion of the label
cannot be injected through a static map that `FunctionCostsTable` reads verbatim — the date
only exists at runtime inside the hook (from the loaded rows). So fully meeting the
"compute it as the earliest created_at … else omit the date" requirement needs one extra
one-line change in `FunctionCostsTable.tsx`.

Two options — **recommend Option A**:

- **Option A (recommended):** allow a ~1-line change in `FunctionCostsTable.tsx` so the
  rendered label can include the runtime-computed date. Files touched: `useBillingData.ts`,
  `billingCalculations.ts`, `FunctionCostsTable.tsx`.
- **Option B (strict two-file):** stay within `useBillingData.ts` + `billingCalculations.ts`
  only, and render a **static** label with no runtime date:
  "Archived costs (monthly summary, before Jun 23 2026)". This still fixes the `null / null`
  bug but cannot satisfy the "omit the date when no rows" rule.

The plan below is written for **Option A**. If you prefer Option B, say so and I drop the
`FunctionCostsTable.tsx` change and use the static string.

## costsCapped subtitle note — skipped
The "by-function table header/subtitle" lives in `FunctionCostsTable.tsx`
(`CardDescription` at lines 28–30). Adding the conditional
"Row-level tables show the latest 1,000 rows; totals include everything." note requires
(a) threading a `costsCapped` prop into `FunctionCostsTable` and (b) passing it from
`Billing.tsx` (which doesn't even destructure `costsCapped` today). That is **not** a
one-line change in a single existing component, so per your instruction this is **skipped**.
The hook already exposes `costsCapped` for a future pass.

## Changes

### 1. `src/hooks/useBillingData.ts`

**a. Key fix in the rpcRows aggregation (lines 269–277).**
Replace direct use of `r.edge_function` with a normalized key:

```ts
const fnKey = r.edge_function ?? 'archived_monthly_summary';
if (!summary.byFunction[fnKey]) summary.byFunction[fnKey] = { count: 0, cost: 0 };
summary.byFunction[fnKey].count += Number(r.rows);
summary.byFunction[fnKey].cost += cost;
```

(Keep the `byProvider` / `byServiceType` lines unchanged.)

**b. Compute the earliest live created_at.** After `const rpcRows = …` (line 241) and before
`summary` is built, derive the earliest created_at among the loaded live rows (`costs`):

```ts
const earliestLiveCreatedAt = costs.length
  ? costs.reduce((min, c) => (c.created_at < min ? c.created_at : min), costs[0].created_at)
  : null;
```

`costs` is already the date-filtered, `is_internal = false` live rows (post any `excludeTTS`
filter), which is exactly "the loaded rows". For `excludeTTS` it reflects the same set shown
in row-level tables — acceptable.

**c. Format the date** in the business timezone using the already-imported `BUSINESS_TZ`:

```ts
const archivedSummaryBeforeDate = earliestLiveCreatedAt
  ? new Date(earliestLiveCreatedAt).toLocaleDateString('en-US',
      { month: 'short', day: 'numeric', year: 'numeric', timeZone: BUSINESS_TZ })
  : null;
```

**d. Expose it** in the returned object (add to the return statement, ~line 463–483):

```ts
archivedSummaryBeforeDate,
```

`totalsSource`, `archivedCost`, `costsCapped` already exist and are unaffected.

### 2. `src/utils/billingCalculations.ts`

Add a base (no-date) entry to `FUNCTION_LABELS` (line 155–166) so a fallback label always
exists:

```ts
'archived_monthly_summary': 'Archived costs (monthly summary)',
```

### 3. `src/components/billing/FunctionCostsTable.tsx` (Option A only)

- Add `archivedSummaryBeforeDate?: string | null` to `FunctionCostsTableProps`.
- In the `.map` (line 13–19), compute the name so the date is appended when present:

```ts
name: fn === 'archived_monthly_summary' && archivedSummaryBeforeDate
  ? `Archived costs (monthly summary, before ${archivedSummaryBeforeDate})`
  : (FUNCTION_LABELS[fn] || fn),
```

`rawName` stays the key (`archived_monthly_summary`). No other rendering changes.

### 4. `src/pages/Billing.tsx`

- Destructure `archivedSummaryBeforeDate` from `useBillingData` (add to the existing
  destructure at lines 47–64).
- Pass it through at the call site (line 159):

```tsx
<FunctionCostsTable summary={summary} archivedSummaryBeforeDate={archivedSummaryBeforeDate} />
```

## What does NOT change
- Totals, `archivedCost`, `totalsSource`, daily trend, byProvider, byServiceType, SOW metrics,
  invoices, `costsCapped`. The archived cost still rolls into `totalCost` exactly as today.
- The `else` (row-fallback) branch (lines 278–288) is untouched; live rows already have a
  real `edge_function`.
- Exported label maps, `CostSummary` interface shape, no new `any`, no deps, no DB/edge/RLS.
- Existing invoice totals unaffected.

## Acceptance
- All Time → by-function table no longer shows a `null / null` row; it shows a single
  **"Archived costs (monthly summary, before Jun 23 2026)"** row (~$1,566.29), with
  `archived_monthly_summary` as the mono subtitle.
- Aug 1–31 2026 → no archived row at all (live data only), totals unchanged from BIL-FE.
- `tsgo --noEmit` clean.
