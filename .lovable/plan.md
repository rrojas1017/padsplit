# Phase 2A — Payment Experience Insight Layer (revised)

Transforms `PaymentExperienceInsightsDashboard` from a flat KPI grid into a layered operational view, using only the structured `research_extraction` fields already produced. No new backend, no new tabs, no charts beyond what's needed for the three insight panels.

## What gets added (in priority order)

### 1. AI Insight banner (top of dashboard) — compact variant
Mirrors the Move-Out `MoveOutOverview` "AI Insight" card but tuned for operational density:
- Reduced vertical padding (`p-4` instead of `p-6`)
- Headline uses `text-sm font-semibold` (not `text-lg`); supporting line `text-xs text-slate-300`
- Single line for footer metadata
- No oversized icon — small `Sparkles` (`w-3.5 h-3.5`) only

Pulls the latest synthesized summary for `campaign_type = 'payment_experience'` from the existing `research_insights` table. If no row exists, falls back to a deterministic client-derived headline assembled from the strongest KPI signal. The friction and auto-pay panels below the KPI row remain the primary visual focus.

### 2. KPI grid with denominator transparency
Local `KPI` component extended with optional `denominator` and `meta` props. Every percentage/average tile shows a small `N=x/y` line under the value.

**Members Surveyed tile** carries provenance inline (legacy "Keyword-detected sample" alert is removed entirely — Payment Experience now has 26,955 `script_id_route` rows, so the warning is obsolete):
```
Members Surveyed
27,431
N=27,431 routed
script_id_route: 26,955 · keyword: 476
```

### 3. Top Payment Friction panel
Compact `Card` listing the top 5 normalized friction themes by frequency. Each row:
- Canonical theme label
- Count + share of analytics-eligible denominator
- One representative `friction_verbatim` quote (truncated to ~140 chars)

### 4. Auto-pay Barrier analysis
Second `Card`, only rendered when ≥1 analytics-eligible record has `autopay_status === 'not_enrolled'`:
- Headline metric: % not enrolled
- Top 5 canonical `autopay_barrier_category` values with counts + share of not-enrolled denominator
- Most common `autopay_unlock_condition` per barrier ("Unlock:" hint)

### 5. Pay-cycle Misalignment — QA / refactor
Uses the new `CADENCE_NORMALIZATION_MAP`. Classification: `weekly | biweekly | semi_monthly | monthly | other | unknown`. Misaligned = total − weekly − unknown. `unknown` excluded from numerator and denominator. KPI tile shows `N=x/y` and a `meta` line with the breakdown count.

## Normalization & quality gating (new)

### `src/hooks/usePaymentExperienceResponses.ts` — explicit constants

```ts
// Canonical category maps prevent aggregation drift from free-text variations.
// Keys are normalized inputs (lowercased, trimmed, punctuation stripped);
// values are canonical bucket labels surfaced in the UI.

export const CADENCE_NORMALIZATION_MAP: Record<string, CadenceBucket> = {
  'weekly': 'weekly', 'every week': 'weekly', '1 week': 'weekly',
  'biweekly': 'biweekly', 'bi weekly': 'biweekly', 'bi-weekly': 'biweekly',
  'every 2 weeks': 'biweekly', 'every two weeks': 'biweekly', 'fortnightly': 'biweekly',
  'semi monthly': 'semi_monthly', 'semimonthly': 'semi_monthly', 'twice a month': 'semi_monthly',
  'monthly': 'monthly', 'every month': 'monthly', 'once a month': 'monthly',
};

export const FRICTION_THEME_MAP: Record<string, FrictionTheme> = {
  'autopay distrust': 'autopay_distrust', 'fear of autopay': 'autopay_distrust',
  'late fee confusion': 'late_fee_confusion', 'unclear fees': 'late_fee_confusion',
  'method failures': 'method_failure', 'card declined': 'method_failure',
  'move in cost surprise': 'move_in_cost_surprise', 'unexpected charges': 'move_in_cost_surprise',
  'pay cycle mismatch': 'pay_cycle_mismatch', 'paid weekly not aligned': 'pay_cycle_mismatch',
  // … extend with the actual top free-text values observed in production
};

export const AUTOPAY_BARRIER_MAP: Record<string, AutopayBarrier> = {
  "don't trust autopay": 'distrust_recurring_charges',
  'fear recurring charges': 'distrust_recurring_charges',
  'no stable income': 'income_irregularity',
  'irregular pay': 'income_irregularity',
  'prefers control': 'wants_manual_control',
  'wants to choose when to pay': 'wants_manual_control',
  'insufficient funds': 'cashflow_constraint',
  // …
};
```

Normalization helper applies: `lowercase → trim → strip punctuation → lookup; fallback to 'other'`.

### Analytics eligibility gate

New per-record flag derived once during mapping:

```ts
export interface PaymentExperienceRecord {
  // …existing fields
  analyticsEligible: boolean;
  ineligibleReason?: 'voicemail' | 'too_short' | 'insufficient_extraction' | 'missing_required_fields';
}
```

Eligibility rules (all must pass):
1. `bookings.has_valid_conversation !== false` (excludes voicemail/no-conversation)
2. Transcript length (when joinable) ≥ a minimum, OR `call_duration_seconds >= 120`
3. Extraction has at least 3 of: `payment_literacy_score`, `autopay_status`, `move_in_cost_clarity_1to5`, `pay_cadence`, `top_friction_theme`
4. No required `p0_signal` errors

All KPI denominators and the Friction / Auto-pay panels operate on **analytics-eligible records only**.

The Members Surveyed tile shows two numbers:
- Top value: total routed (matches infra counts)
- Meta line: `eligible: x · excluded: y (voicemail z · short w · partial v)`

## Out of scope (intentionally deferred)

- New tabs, new routes, new charts
- Member-level slide-over / drill-down
- Server-side AI synthesis pipeline changes (banner only consumes existing `research_insights` rows; client-derived fallback when absent)
- Export / PDF, comparative period analysis

## Technical notes

**Files touched**
- `src/components/payment-experience/PaymentExperienceInsightsDashboard.tsx` — remove legacy "Keyword-detected sample" alert; add compact AI banner + Friction panel + Auto-pay panel; extend local `KPI` with `denominator` and `meta` props
- `src/hooks/usePaymentExperienceResponses.ts` — add normalization constants, `analyticsEligible` derivation, `payCycleBreakdown`, denominators, `topFrictionThemes[]`, `autopayBarriers[]`, `retagSourceCounts`, `eligibilityStats`
- (new) `src/hooks/usePaymentExperienceAIInsight.ts` — fetches latest `research_insights` row for `campaign_type='payment_experience'`; returns `{ headline, finding, generatedAt, totalAnalyzed, source: 'ai' | 'derived' }`

**Data sources (all already populated)**
- `booking_transcriptions.research_extraction`
- `booking_transcriptions.retag_source`
- `bookings.has_valid_conversation`, `bookings.call_duration_seconds`
- `research_insights` (when present)

**Layout**

```text
┌──────────────────────────────────────────┐
│  AI Insight (compact, dense)             │
├──────────────────────────────────────────┤
│  KPI grid — every tile shows N=x/y       │
│  (Members Surveyed shows routed split)   │
├────────────────────┬─────────────────────┤
│ Top Payment        │ Auto-pay Barriers   │
│ Friction (top 5)   │ (top 5 + unlock)    │
└────────────────────┴─────────────────────┘
```

Stacks single-column under `md`. No new dependencies. Styling via existing tokens.

## Acceptance checks

- Legacy "Keyword-detected sample" alert is gone
- Members Surveyed tile shows `script_id_route: 26,955 · keyword: …` inline
- AI banner is visually compact — does not dominate the page; friction/auto-pay panels read as primary content
- All KPI percentages and the two insight panels compute against `analyticsEligible === true` records only
- Eligibility stats visible under Members Surveyed (eligible vs excluded with reasons)
- Aggregations use the three normalization maps; no inline string matching for friction, autopay barriers, or cadence
- Pay-cycle Misalignment % matches normalized breakdown; `unknown` excluded from both sides
- Move-Out and Audience Survey dashboards untouched
