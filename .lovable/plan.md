# P-G4 (RES-16b): label public and agent-logged answers with the right survey

Only these 2 files change: `supabase/functions/submit-public-script/index.ts` and `supabase/functions/persist-research-raw-answers/index.ts`. Auth guards and abuse controls stay byte-identical. No migrations, RLS or config changes. Nothing is published. The only live requests are anon POST {} checks.

Each file gets the same small helper, because edge functions cannot share code with process-research-record. It is copied into each file rather than added to a shared module, so nothing outside the two files changes.
```ts
const ROUTE_SCRIPT_ID_MAP: Record<string, string> = {
  '6397bb7f-ac6a-49ea-90ad-9ca6ec046434': 'move_out_survey',
  'c701a243-1c66-425a-8f79-99a290ec5b6b': 'payment_experience',
};
function resolveResearchCampaignType(script: { id: string; slug?: string | null } | null): string | null {
  if (!script?.id) return null;
  if (ROUTE_SCRIPT_ID_MAP[script.id]) return ROUTE_SCRIPT_ID_MAP[script.id];
  if (script.slug && ['payment_experience', 'audience_survey'].includes(script.slug)) return script.slug;
  return script.slug || `script_${String(script.id).slice(0, 8)}`;
}
```

## 1. submit-public-script/index.ts
- **Helper:** added above `Deno.serve`, after the imports and constants at the top of the file.
- **Line 209 (script select):** add `slug`, giving `'id, questions, questions_es, is_active, slug'`.
- **Lines 386-389 (booking_transcriptions insert):** add the label fields:
  ```ts
  const routedType = resolveResearchCampaignType(script);
  ...insert({ booking_id, research_extraction: {...},
    ...(routedType ? { research_campaign_type: routedType, retag_source: 'script_id_route' } : {}) })
  ```
  The script always exists at this point, so the label is always set. The hard-coded `'move_out_survey'` from the report is not in this insert today; the database default applies because the column is omitted. Setting it explicitly fixes this.
- The response shape and every other path are unchanged.

## 2. persist-research-raw-answers/index.ts
- **Helper:** added after the imports (after line 8).
- **Just before line 139 (before the transcription lookup):** resolve the script once, as a non-fatal lookup:
  - `research_campaigns.script_id` via `call.campaign_id`, then `research_scripts` `id, slug`.
  - `routedType = resolveResearchCampaignType(script)`, or `null` when there is no campaign or script.
  - Errors are logged by message only and leave `routedType` as `null`.
- **Line 141 (existing-row select):** add `research_campaign_type`.
- **Line 148 (insert when missing):** add `research_campaign_type: routedType, retag_source: 'script_id_route'` only when `routedType` is set.
- **Lines 160-163 (update of an existing row):** also relabel when `routedType` is set, `routedType !== 'move_out_survey'`, and the existing `research_campaign_type` is null or `'move_out_survey'`. In that case add `research_campaign_type: routedType, retag_source: 'script_id_route'` to the same update. Existing payment_experience, audience_survey or script_* labels are never touched.
- The later script_responses block (lines 172-220) keeps its own lookup unchanged. It is left alone to keep the change minimal, which means one duplicate script query.
- Logs contain ids and labels only, never answers, names or phone numbers.

## Not included (needs your call)
The already mislabelled public 30-Day submission (and any similar rows) stays labelled `move_out_survey`. Fixing existing rows is a data change. I can list the affected rows with a read-only query and give you the correction SQL separately, if you want.

## Verification
- `deno check` on both functions.
- Deploy both.
- anon POST {}: submit-public-script should return the same invalid-request error as today (400/403); persist-research-raw-answers should return 401.
