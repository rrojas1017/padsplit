# LP-1 — Payment Experience KPI correctness

Goal: every Payment Experience number comes from one answer resolver and one exact-match normalizer. Frontend only. Exported names, signatures and object shapes stay the same; the only addition is an optional `otherCount` field.

## 1) New: src/utils/paymentExperienceNormalize.ts
- `canon(s: unknown): string` — lowercases the text, turns every run of characters other than `[a-z0-9']` into one space, then trims.
- Five exact-key lookups, built from the lists in your brief. There is no substring or "contains" matching anywhere.
  - `normalizeCadence` returns `CadenceBucket`: empty or unrecognised-unknown → `unknown`; any other value not in the map → `other`.
  - `normalizeAutopay` returns `'yes' | 'no' | 'unanswered'`.
  - `normalizeFriction` returns `string | null`: null when empty; any other value not in the map → `other`.
  - `normalizeBarrier` returns `string | null`: null when empty; `n a`, `na`, `none` → `unanswered`; any other value not in the map → `other`.
- `resolveAnswer(record, qid)` returns `string | number | null`:
  - It uses `extraction.raw_script_answers[qid]` when `status === 'answered'`, or when status is missing but the answer has a non-empty `selected_option_labels[0]` or a numeric `scale_value`.
  - It returns `scale_value` for `move_in_cost_clarity`, otherwise `selected_option_labels[0]`.
  - Otherwise it falls back to the legacy field: pay_cadence→`pay_cadence`, autopay_enrolled→`autopay_status`, top_friction_theme→`top_friction_theme`, autopay_barrier→`autopay_barrier_category`, move_in_cost_clarity→`move_in_cost_clarity_1to5`.
- Convenience helpers: `resolvedCadence(r)`, `resolvedAutopay(r)`, `resolvedFriction(r)`, `resolvedBarrier(r)`, `resolvedClarity(r)` (a number from 1 to 5, else null).
- Its only import is the `PaymentExperienceRecord` type. The legacy `autopay_status` values `enrolled`/`not_enrolled` map through the autopay map.

## 2) src/hooks/usePaymentExperienceResponses.ts
- **Lines 143-183:** delete `normalizeKey`, `lookup`, `normalizeCadence`, `normalizeFriction` and `normalizeAutopayBarrier`.
- **The exported maps and labels at lines 24-140 stay exported,** because other code imports them. The new module holds its own exact-key tables.
- **Lines 261-266 `FrictionSummary`:** add the optional field `otherCount?: number`.
- **Lines 283-298 eligibility:** unchanged.
- **Lines 305-354 `deriveKPIs`:**
  - Auto-pay = yes ÷ (yes + no) from `resolvedAutopay`.
  - Clarity = mean of `resolvedClarity`.
  - The pay-cycle breakdown comes from `resolvedCadence`. Misalignment = (biweekly + semi_monthly + monthly) ÷ (weekly + biweekly + semi_monthly + monthly).
  - Literacy and hardship are unchanged.
- **Lines 356-398 `aggregateFrictionThemes`:** use `resolvedFriction`. share = count ÷ (answered − no_friction). The top 5 leave out `other`, which is returned as `summary.otherCount`.
- **Lines 400-429 `aggregateAutopayBarriers`:** only records whose resolved autopay is `no` count, with denominator = the number of `no` answers. The key comes from `resolvedBarrier`.
- **Line 431:** `computeEligibilityStats` becomes exported; its body is unchanged.

## 3) src/utils/paymentExperienceAnalytics.ts
- **Lines 38-77:** delete the local `normalizeKey`/`lookup`/`normalize*` helpers. `deviceBucket` (lines 79-86) keeps a small local `canon`-based key from the new module.
- **Every `normalizeCadence(r.extraction?.pay_cadence)`, `normalizeFriction(...)` and `normalizeBarrier(...)` call** switches to the `resolved*` helpers. That covers lines 125, 240, 324-327, 352, 395, 435, 440, 458, 510, 525, 569, 635 and 651.
- **Lines 592-615 `computeSurveyFunnel`:** Not on auto-pay = `resolvedAutopay === 'no'`. Cash-flow = barrier `cashflow_constraint` or `income_irregularity`. Trust/control = `distrust_recurring_charges` or `wants_manual_control`. The signature is unchanged.
- **Autopay checks:** any other `autopay_status === 'enrolled'/'not_enrolled'` checks in this file switch to `resolvedAutopay`.

## 4) src/utils/paymentExperienceScriptResponses.ts
- **Lines 97-114:** delete `lookupNormalized`.
- **Lines 224-229 pay_cadence and 297-311 autopay_enrolled / autopay_barrier / top_friction_theme / move_in_cost_clarity:** these use the new module.
  - Q8 = `resolvedAutopay`, mapped to 'yes'/'no'; unanswered → null.
  - The barrier is asked only when resolved autopay is `no`.
- **Raw-answer path for those 5 question ids:** it goes through `resolveAnswer` first, so the Q8 Yes % equals the Auto-pay tile.
- **Lines 279-283 reminder_system:** return `null`. The `payment_literacy_notes` fallback is removed, so only raw answers count.
- **Lines 521-535 scale buckets:** replaced by half-open buckets `[lo, nextLo)`, where the last bucket includes `max`.
  - Dues questions add a "Below $50" row (< 50) first and an "Above $300" row (> 300) last.
  - The overdue threshold adds an "Above $2,000" row.
  - Every numeric answer lands in exactly one row, so the percentages sum to 100% of numeric answers (plus Unsure for dues).
  - The 1-5 integer scale path (lines 516-519) is unchanged.

## 5) src/components/payment-experience/PaymentExperienceInsightsDashboard.tsx
- **Lines 15-37 `filterByDateRange`:** build local `yyyy-MM-dd` bounds with a `ymd(date)` helper that reads the Date's local fields. Compare them to the `booking_date` string: `start <= d < endExclusive`. Last Month = the 1st of the previous month (inclusive) to the 1st of this month (exclusive). It no longer uses `new Date(booking_date)`.
- **Lines 186-196:**
  - Add `const filteredEligibility = useMemo(() => computeEligibilityStats(records), [records])`.
  - `frictionSummary` comes from `aggregateFrictionThemes(eligibleRecords).summary`, so the banner uses the date-filtered, corrected values.
  - The `as any` casts on these lines are removed where the types already match. No new `any` is added.
- **Lines 260 and 365-370:** use `filteredEligibility` instead of the all-time `eligibilityStats`.
- **Banner headline:** it already reads `kpis.autopayEnrolled`, so it now shows the corrected auto-pay value.

## Acceptance targets (live data, 2026-09-24)
- **All Time:** Members Surveyed 606 of 4,065 routed. Auto-pay 25.5% (139 of 546), and the Q8 Yes % is also 25.5%. Pay-cycle 58.6% (318 of 543). Clarity 4.47. Hardship 63.6%. Literacy 76.7. Funnel 606 → 407 → 61 → 225.
- **June 2026:** there is no "June" option in the date picker, so this is checked by calling the helpers on records filtered to June: 181 eligible of 215 routed, Auto-pay 24.2%, Pay-cycle 57.0%, Clarity 4.35.

## After implementation
- `npx tsgo --noEmit -p tsconfig.app.json` clean.
- Report the results. Nothing is published.
