# P6-A — void invoices + research/platform AI cost in invoice internal cost

Frontend only, three files. No migrations, SQL, edge functions, RLS or config. Not published. Existing invoices render the same numbers (history shows stored `raw_cost_usd` / `markup_usd` / `total_usd`, which are untouched). Billing stays super_admin only (Billing.tsx untouched; it passes `updateInvoiceStatus` straight through, so widening the type is enough).

## 1) src/hooks/useBillingData.ts
- Line 58: `status: 'draft' | 'sent' | 'paid' | 'void'`.
- Lines 352–358 (createInvoice): if `error.code === '23P01'` throw `new Error('An invoice for this client already covers part of this period. Void the existing invoice first.')`; else `throw error` as today.
- Line 373: `updateInvoiceStatus(id, status: 'draft' | 'sent' | 'paid' | 'void')`. Body unchanged (trigger errors are thrown as-is, so their message reaches the toast).
- Lines 430–450 (fetchPeriodCounts): keep `internalCost` calculation, renamed `bookingInternalCost`. Add `supabase.rpc('invoice_platform_costs', { p_start: startDate, p_end: endDate })` (already typed in types.ts, line 3278; no cast needed). Read row 0: `researchCost`, `researchRows`, `platformCost`, `platformRows` (Number(), default 0). On error: one `console.warn('[Billing] invoice_platform_costs unavailable')` (no payload), costs 0, `platformCostsUnavailable: true`. Return adds `bookingInternalCost, researchCost, platformCost, researchRows, platformRows, platformCostsUnavailable`, and `totalInternalCost = bookingInternalCost + researchCost + platformCost`.

## 2) src/components/billing/InvoiceGenerator.tsx
- Lines 20–28: PeriodCounts gets the new fields.
- Lines 123–124: margin formula unchanged (`grandTotal − totalInternalCost`).
- Lines 142–153: `cost_breakdown.internalCostBreakdown = { bookings, research, platform, researchRows, platformRows }`; `internalCost` stays `totalInternalCost`. No new line items; PDF unchanged.
- Lines 161–162: catch shows `error.message` when it equals the overlap message, else 'Failed to generate invoice'.
- Lines 303–306: after the existing "Internal Cost" total row, three indented muted rows: "Bookings processing", "Research & insights AI", "Platform AI (insights, translations)". If `platformCostsUnavailable`, a small muted note "Research/platform cost unavailable — internal cost shows bookings only".

## 3) src/components/billing/InvoiceHistory.tsx
- Line 8: import `Ban`; add AlertDialog imports from `@/components/ui/alert-dialog`.
- Lines 20, 40: status types accept `'void'`.
- Lines 24–28: `void: { label: 'Void', icon: Ban, variant: 'destructive' }`; helper `getStatusConfig(s)` falls back to draft for unknown values (used at lines 111, 138–140).
- Lines 40–47: toast error uses `error.message` when present, else the current text.
- New state `pendingVoid: BillingInvoice | null`; choosing Void opens an AlertDialog "Void INV-xxx? A void invoice cannot be reopened." with Cancel / Void; confirming calls handleStatusChange(id, 'void').
- Line 112/118: void cards get `opacity-60`; `isOverdue` false for void.
- Lines 236–248: Select disabled when void; options Draft, Sent, Paid, Void; Draft and Sent disabled when status is paid.

## Verification
- `tsgo --noEmit -p tsconfig.app.json`; report exact changed line ranges per file.
- No RPC call, no invoice created or changed; nothing published; roadmap.md updated.
