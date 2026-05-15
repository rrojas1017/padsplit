## Goal

Make the Payment Experience dashboard's provenance signals honest: every record carries a `retag_source`, and the "validation sample" banner shows whenever none of the visible records are script-linked.

## Changes

### 1. Backfill the 9 organic records

Data update on `booking_transcriptions`:

```sql
UPDATE booking_transcriptions
SET retag_source = 'keyword_fallback_detection'
WHERE research_campaign_type = 'payment_experience'
  AND retag_source IS NULL;
```

Expected: 9 rows updated. These are records the normal `detectCampaignContext` keyword fallback tagged during prior batch runs — not script-id routed, just a different code path than the Phase 1A backfill.

### 2. Reserve `script_id_route` as a vocabulary value

No schema change needed (`retag_source` is free-text TEXT). Document the three valid values in code comments only:

- `payment_keyword_validation` — Phase 1A one-off backfill
- `keyword_fallback_detection` — runtime keyword fallback in `process-research-record`
- `script_id_route` — reserved for Phase 1B deterministic script-id linkage (not yet emitted)

Add a small constant block in `supabase/functions/process-research-record/index.ts` and in `src/hooks/usePaymentExperienceResponses.ts` so both ends share the vocabulary.

Optional follow-up (not in this phase): write `retag_source = 'keyword_fallback_detection'` going forward whenever `detectCampaignContext` lands on `payment_experience` via keywords. Flag for Phase 1B.

### 3. Update banner logic

In `src/components/payment-experience/PaymentExperienceInsightsDashboard.tsx`:

Replace:

```ts
const allValidationSample =
  records.length > 0 && records.every((r) => r.retag_source === 'payment_keyword_validation');
```

With:

```ts
const scriptLinkedCount = records.filter((r) => r.retag_source === 'script_id_route').length;

const hasOnlyKeywordDetectedRecords =
  records.length > 0 && scriptLinkedCount === 0;

const hasMixedProvenance =
  records.length > 0 && scriptLinkedCount > 0 && scriptLinkedCount < records.length;
```

Then:

if (hasOnlyKeywordDetectedRecords) {

  // Keyword-detected sample — no records are linked via script_id yet. Permanent linkage pending Phase 1B.

}

if (hasMixedProvenance) {

  // Mixed provenance — some records are script-linked, while others were keyword-detected.

}

&nbsp;

Update the banner copy to reflect the broader meaning:

> "Keyword-detected sample — no records are linked via script_id yet. Permanent linkage pending Phase 1B."

## Verification

- Re-query: `SELECT retag_source, count(*) FROM booking_transcriptions WHERE research_campaign_type='payment_experience' GROUP BY 1;` → expect `payment_keyword_validation: 14`, `keyword_fallback_detection: 9`, no NULLs.
- Reload `/research/insights?campaign=payment_experience` → KPIs still show 23 surveyed, banner now visible (since none are `script_id_route`).

## Out of scope

- Emitting `keyword_fallback_detection` from the live `process-research-record` path (Phase 1B trace will define the right hook point).
- Any change to KPI math or extraction routing.