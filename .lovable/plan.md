# BIL-FE — Billing totals + usage PDF rates

Frontend only. Three files changed: `src/hooks/useBillingData.ts`, `src/pages/Billing.tsx`, `src/components/billing/UsageDetailPDFGenerator.ts`. No DB, edge function, RLS or dependency changes. Nothing published.

## 1. BIL-18 — Costs tab totals from `billing_cost_summary` (useBillingData.ts)

- **Date range (lines 104–127, `getDateRange`)**: replace the date-fns preset logic. The hook accepts the existing `DateRangeType` plus the custom dates. It maps them to `resolveRange` presets (today, yesterday, thisWeek→Monday..today in ET, thisMonth→month, last7Days→7d, last30Days→30d, allTime→all, custom→custom). It returns `from`/`to` as 'yyyy-MM-dd' ET strings.
- **New helper, local to the hook**: `etMidnightIso(ymd)` returns the ISO instant of 00:00 America/New_York on that day. The offset (-04:00 or -05:00) comes from `Intl.DateTimeFormat` with `timeZoneName: 'longOffset'`, so the change to and from daylight saving time is handled. Values:
  - `p_start` = etMidnightIso(from)
  - `p_end` = etMidnightIso(to + 1 day), exclusive
  - All Time: `p_start` = '2020-01-01T00:00:00-05:00', `p_end` = etMidnightIso(today + 1)
- **The existing row query (lines 143–150)** uses the same instants: `.gte(p_start).lt(p_end)` instead of the browser-local start and end.
- **fetchData**: runs `supabase.rpc('billing_cost_summary', { p_start, p_end })` alongside the row query, typed with a local `CostSummaryRow` interface (no `any`). The result goes into new state `rpcSummary: CostSummaryRow[] | null`.
  - If the call errors with a message containing 'forbidden', or with any other error, `rpcSummary` stays null (the old behaviour) and the error is logged.
- **Totals (lines 206, 230–250)**: when `rpcSummary` is present, these are summed from its rows:
  - `totalCost`, `byProvider`, `byServiceType`, `byFunction` (count = `rows`, cost = `cost_usd`)
  - `excludeTTS` applies the same filter to the RPC rows (service_type starting with `tts_` or equal to `qa_script_generation`).
  - Otherwise the current client-side sums from the loaded rows are kept.
  - `costPerBooking` and `costPerMinute` keep using the RPC total over the row-based counts (unchanged when the RPC is unavailable).
- **Row-level figures** (daily trend, per-agent, voice/text record counts, unique bookings, talk time) stay row-based.
- **New return fields**: `costsCapped: boolean` (true when the rows loaded equal the server's row cap, detected as `costsRaw.length >= 1000`), `totalsSource: 'rpc' | 'rows'` and `archivedCost: number` (the sum of rows where source = 'archived').

## 2. Billing.tsx — preset mapping (lines 36–45) and cap label

- Add a `'last7Days'` value to `DateRangeType` in the hook (additive, so existing callers keep working).
- Mapping: '7d'→last7Days, '30d'→last30Days; the rest are unchanged. All presets resolve through `resolveRange` inside the hook (section 1). This keeps Billing.tsx limited to the preset mapping.
- The "latest 1,000 rows" label: the detail tables are rendered in child components, which are outside scope. Only the preset mapping changes in Billing.tsx. I will add the label only if a detail table header lives inside Billing.tsx itself; otherwise `costsCapped` is exposed and a follow-up adds the label.

## 3. BIL-14 — Usage PDF rates from the invoice snapshot (UsageDetailPDFGenerator.ts)

- **Rates, now fetched instead of hard-coded (lines 16–21)**: `SOW_RATES` stays as the last-resort default. A new async `resolveRates(invoiceNumber)`:
  1. Looks up `billing_invoices.id` by `invoice_number`, then its `invoice_line_items` (`service_category`, `unit_rate`).
  2. For each of voice_processing, text_processing, email_delivery and sms_delivery, it uses the line item's `unit_rate`.
  3. If there is no line item for a category, it uses the active `sow_pricing_config.unit_rate` (or the column that holds the rate) for that category.
  4. If neither exists, it uses the hard-coded default.
  - This needs no signature change, so `InvoiceHistory.tsx` stays untouched.
- **Rates passed through the drawing functions**: `rates: Record<string, number>` is threaded into the cover (lines 203–206), the communications page (line 395), the reconciliation (lines 446–449) and the main export (lines 506–549, the voice and text detail calls).
- **Invoice totals are unchanged**: invoice totals come from the invoice rows, not from this PDF, and the PDF now matches the stored line-item rates.

## Checks after implementation

- `npx tsgo --noEmit -p tsconfig.app.json` must pass clean.
- A read-only SQL comparison for Aug 2026 (ET) and All Time. The RPC itself needs super_admin, so the numbers are confirmed with an equivalent direct sum.
- The report lists anything not verifiable from here.

## Assumptions

- The PostgREST server cap is 1,000 rows, even though the code asks for 5,000, which is why All Time shows $31.91.
- The `sow_pricing_config` rate column name is confirmed by a read before coding. It is used only as the fallback.
