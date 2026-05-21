## Problem

The Payment Experience script defines **16 questions**, but the new Script Responses tab only renders **9**. The shortfall is in `src/utils/paymentExperienceScriptResponses.ts`, where `PE_QUESTIONS` was hand-derived from the 9 most common extraction fields and missed the rest of the script.

The underlying `research_extraction` JSON actually carries more than 9 signals — including `payment_literacy_breakdown` (sub-flags), `channel_method`, `easy_payment_benchmark`, `overdue_threshold_belief_usd`, `hardship_awareness_padsplit`, `hardship_awareness_host`, `desired_payment_methods`, and `wish_capability`/`wish_verbatim` — so we can map all 16 script questions client-side without any new query, table, or backend change.

## Approach

Presentation-only update to the derivation utility. No changes to hooks, queries, KPIs, or other tabs.

### Updated question list (1:1 with the script, in script order)

| # | Script question (short) | Type | Source field(s) in `research_extraction` |
|---|---|---|---|
| 1 | Pay cadence | multi | `pay_cadence` (normalized via existing `CADENCE_NORMALIZATION_MAP`) |
| 2 | Dues day awareness | yes/no | `payment_literacy_breakdown.dues_day_correct` |
| 3 | Dues amount understanding | yes/no | `payment_literacy_breakdown.dues_amount_correct` |
| 4 | Commitment understood | yes/no | `payment_literacy_breakdown.commitment_understood` |
| 5 | How they remember to pay | open | `payment_literacy_notes` (fallback for reminder system; truncate to verbatim list) |
| 6 | Easy-payment benchmark | open | `easy_payment_benchmark` |
| 7 | Payment channel / method | multi | `channel_method.method` (and device as secondary if present) |
| 8 | Auto-pay enrolled? | yes/no | `autopay_status` (`enrolled` vs `not_enrolled`) |
| 9 | Auto-pay barrier | multi | `autopay_barrier_category` (existing `AUTOPAY_BARRIER_MAP`) |
| 10 | Move-in cost clarity (1–5) | scale | `move_in_cost_clarity_1to5` |
| 11 | Top payment friction | multi | `top_friction_theme` (existing `FRICTION_THEME_MAP`) + sample `friction_verbatim` |
| 12 | Overdue threshold belief | scale/open | `overdue_threshold_belief_usd` (numeric → scale histogram) with `overdue_threshold_accuracy` shown as label |
| 13 | Hardship options — PadSplit | open | `hardship_awareness_padsplit` (fallback to `hardship_details`) |
| 14 | Hardship options — Host | open | `hardship_awareness_host` |
| 15 | Desired payment methods | multi | `desired_payment_methods` (array — count occurrences across records) |
| 16 | One thing they would change | open | `wish_capability` (fallback `wish_verbatim`, then `wish_capabilities`) |

Each question pulls `order`, `section`, and the canonical question text directly from the script-style metadata embedded in `PE_QUESTIONS` so the UI stays aligned with the actual survey copy.

### Code changes

- `src/utils/paymentExperienceScriptResponses.ts`
  - Replace `PE_QUESTIONS` (9 entries) with the 16-entry list above. Keep types `multi | yesno | scale | open` so the existing `ScriptResponsesTab` visuals work unchanged.
  - Add helpers for the new shapes:
    - Dotted-path getter for `payment_literacy_breakdown.*` booleans.
    - Array aggregator for `desired_payment_methods` (each array element counts once per record toward distribution).
    - Numeric coercion for `overdue_threshold_belief_usd`.
    - Object-path read for `channel_method.method`.
  - Adjust `derivePaymentExperienceScriptData` to:
    - Iterate the new question list.
    - Compute `count`, `distribution`, `avg/min/max`, and verbatim `samples` per question type, exactly as today.
    - Recompute `stats.questionCount = 16` and `avgQuestionsAnswered` against the new denominator.
  - Update CSV column emission in `downloadPaymentExperienceScriptCsv` so all 16 questions appear in script order.

### Out of scope

- No changes to hooks, KPIs, eligibility, other tabs, schema, edge functions, or backend.
- No new chart libraries; reuse the existing CSS-only multi/yes-no/scale/open visuals in `ScriptResponsesTab`.
- No re-extraction; questions whose source field is missing on older records simply show a lower response count, which is the correct behavior.

## Acceptance criteria

- Script Responses tab renders **16** question cards in script order, grouped by their original sections.
- Question text, type, and order match `research_scripts` for the Payment Experience survey.
- "Jump to question…" dropdown lists all 16.
- CSV export includes all 16 questions.
- No regressions to other Payment Experience tabs.
- No TypeScript errors.