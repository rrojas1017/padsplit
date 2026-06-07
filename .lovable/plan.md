# Refine Payment Experience Open-Ended Clusters

Scope: only `src/utils/openEndedResponseClusters.ts` and `src/components/payment-experience/insights/OpenEndedClusters.tsx`. No backend, no other UI, no CSV/print/extraction changes.

## 1. Store every response inside its cluster

`src/utils/openEndedResponseClusters.ts`
- Extend `OpenEndedCluster` with `responses: string[]` (full ordered list of every response assigned to that cluster, duplicates preserved).
- Keep `examples: string[]` for backwards compatibility (still capped + case-insensitive deduped, derived from `responses`).
- In `clusterOpenEndedResponses`, push every classified response into `bucket.responses` (no cap, no dedupe). Examples logic unchanged.
- Sorting unchanged: named clusters by count desc, `Other responses` always last.

## 2. Expand deterministic clustering rules

In the `RULES` array, add/refine entries so fewer answers fall into Other. Order from most specific to broadest; first match wins.

New / expanded clusters (keyword sets, lowercased substrings):
- `clarity_communication` — "clear", "clarity", "explain", "explanation", "instructions", "communicate", "communication", "transparent"
- `customer_support` — "support", "customer service", "rep", "agent", "chat", "phone call", "call back", "callback", "answer the phone"
- `late_fees` — "late fee", "late charge", "penalty", "penalt" (moved before generic `fees_charges`)
- `payment_processing` — "process", "post", "posted", "pending", "didn't go through", "declined", "fail", "error", "glitch", "bug"
- `receipt_history` — "receipt", "history", "statement", "record", "proof", "confirmation"
- `lower_price` — "cheaper", "lower", "too expensive", "too high", "afford", "price", "rate", "cost too much"
- `partial_payments` — "partial", "split", "break it up", "pay half", "smaller payment", "installment"
- `refunds` — "refund", "reimburs", "credit back", "money back"
- `positive_feedback` — "easy", "simple", "great", "love", "perfect", "smooth", "no problem", "satisfied", "happy", "convenient" (only triggers when no negative cluster matched — handled by ordering it AFTER specific negative clusters but before Other)
- Expand `no_issue` exact matches to also include: "all is well", "everything is fine", "everything good", "no complaints", "not really", "not at all", "nothing comes to mind", "i don't know", "idk", "unsure"
- Expand `payment_reminders` keywords: "warning", "heads up", "before due", "advance notice"
- Expand `due_date_flex` keywords: "grace period", "push back", "later date", "earlier date", "change date", "different date"
- Expand `payment_methods` keywords: "money order", "check", "transfer", "wire", "crypto"
- Expand `app_confusion` keywords: "login", "log in", "sign in", "ui", "interface", "buttons", "menu", "slow", "lag", "crash"
- Expand `hardship` keywords: "covid", "sick", "injury", "laid off", "fired", "behind"

Final rule order (top to bottom):
1. `no_issue` (exact + expanded set)
2. `late_fees`
3. `payment_reminders`
4. `due_date_flex`
5. `autopay`
6. `payment_methods`
7. `payment_processing`
8. `partial_payments`
9. `refunds`
10. `receipt_history`
11. `fees_charges`
12. `lower_price`
13. `hardship`
14. `app_confusion`
15. `clarity_communication`
16. `customer_support`
17. `host_support`
18. `positive_feedback`
19. → `other`

## 3. Render full responses inside each opened cluster

`src/components/payment-experience/insights/OpenEndedClusters.tsx`
- Remove the "Example responses" capped block.
- New per-cluster body using `cluster.responses`:
  - Section label: `All responses in this cluster` with `Quote` icon.
  - Wrapper `<div>` with `max-h-96 overflow-y-auto pr-1 space-y-2`.
  - Each response rendered as a numbered muted quote block:
    - `bg-muted/30 border-l-[3px] border-amber-300/60 rounded-r-md p-3`
    - `text-sm text-muted-foreground italic leading-relaxed whitespace-pre-wrap break-words`
    - Prefix `<span className="not-italic font-medium text-foreground/70 mr-2 tabular-nums">{i + 1}.</span>`
- Per-cluster progressive disclosure:
  - New state `Map<clusterId, boolean>` for `expandedCluster`.
  - If `cluster.responses.length <= 10`, render all directly.
  - Else render first 10 by default; add an inline `Button variant="ghost" size="sm"` inside that cluster's content:
    - `Show all {count} responses` ↔ `Show fewer`
  - Control lives inside the `AccordionContent`, below the response list.
- Keep `cluster.summary` rendering above the list.
- No global "All responses" section, no global "Show all responses" button (already absent, confirm removal stays).
- Header text and counters unchanged (already match spec: "Response Clusters" / "Representative Response Clusters", "Based on N written/available sample responses").
- Show-all-clusters control (named > 5) unchanged.
- Small-sample fallback (`< 3`) unchanged.

## 4. Preserve full-response input

Call sites already pass `summary.allResponses ?? summary.samples ?? []` — not changing. `validResponses` still trimmed, blanks dropped, duplicates preserved.

## Out of scope

Topic tabs, KPIs, Executive Summary, Survey Funnel, jump-to-question, non-open question cards, CSV export, printable report, Supabase queries, extraction, backfills, `raw_script_answers`, eligibility logic.

## Acceptance

- Every valid written response is assigned to exactly one cluster and rendered inside that cluster when opened.
- No global "All responses" section or button.
- Cluster counts/percentages reflect the full response set, duplicates included.
- `Other responses` stays last; named clusters sort by count desc.
- Expanded keyword rules shrink Other.
- Per-cluster "Show all N responses / Show fewer" works when count > 10.
- Mobile (375/390/414): wraps cleanly, scrolls vertically, no horizontal overflow.
- No TypeScript errors.
