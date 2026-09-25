# CR-005 Phase 2 — Frontend for form + recording linking

## Important correction on item 5
Campaign Manager (`src/pages/research/CampaignManager.tsx`) shows no public link. The "External Link" popover lives in **`src/pages/research/ScriptBuilder.tsx`** (lines ~200–245). It shows one link per **script** (`getScriptPublicUrl(token.token)`), not per campaign. The screen-pop URL goes in that popover. `CampaignManager.tsx` stays unchanged. Scripts have no `campaign_key`, so the rule becomes: show the new block only when the script has an active token (the popover only renders then). The `campaign` value comes from the ViciDial placeholder `--A--campaign--B--`.

## Files that change (and nothing else)
1. `src/pages/PublicScriptView.tsx`
2. `src/hooks/useReportsData.ts` (badge data only)
3. `src/pages/Reports.tsx` (badge + CSV "Intake" column only)
4. `src/components/research-insights/ScriptInsightsPanel.tsx`
5. `src/pages/ApiDocs.tsx`
6. `src/pages/research/ScriptBuilder.tsx` (External Link popover only)

No edge functions, SQL, migrations, types.ts or other files. No new dependencies.

## 1. PublicScriptView.tsx — screen-pop parameters
- Add a module-level pure `sanitizeDialer(v, phone?)`: returns `undefined` for non-strings. Otherwise it removes `[\u0000-\u001f\u007f]` and trims. Phone values keep digits only. The result is dropped if empty, longer than 64 characters, or (for phone) longer than 15 digits. Wrapped in try/catch so it never throws.
- Add `dialerParamsRef = useRef<Record<string,string>>` that is filled once. The initializer reads `new URLSearchParams(window.location.search)` for `uid, lead, phone, agent, campaign` and maps them to `dialer_uid, dialer_lead, dialer_phone, dialer_agent, dialer_campaign`, keeping only present keys. It uses a lazy init guard and never uses state, so it causes no re-render.
- Restart (line ~335) does not touch it, so the values survive Restart.
- In the single `submit-public-script` invoke body (line ~213), add `...dialerParamsRef.current` after the existing fields. This covers autosave and final saves because both go through this one function. With no parameters it spreads `{}`, so the body is identical to today.
- The values are never rendered, toasted or logged. Save queue, save_seq, banner, generation counter, timeout, Restart gating, startedAt, token and language logic stay untouched.

## 2. Reports intake badge
- `useReportsData.ts`: after the main query, collect distinct `research_call_id` from research rows on the current page. If there are any, run one batched query:
  `supabase.from('research_calls').select('id, kixie_link, source:responses->>_source').in('id', ids)`.
  Build `intakeById[bookingId]` = `'Form + Recording' | 'Form only' | 'Recording only'`, using the rules in the ticket. The value is undefined when there is no research call or neither signal is present. It is exposed as a new `researchIntakeById` return value, following the `researchProgressById` pattern. A query error only leaves the map empty and never fails the page.
- `Reports.tsx`: next to the existing "Ended early" badge (line ~1136), render `<Badge variant="outline" className="text-[10px] px-1.5 py-0">{intake}</Badge>` when present. The research CSV gets an `Intake` header and a matching cell (empty when there is none). Filters, counts, sorting and other columns stay unchanged.

## 3. ScriptInsightsPanel Submissions tab
- Add `kixie_link` to the existing `research_calls` select (line ~484) and the `SubmissionRow` type. Derive intake from `kixie_link` plus `responses._source === 'public_script'`, reusing the same three labels.
- Render the badge in the existing Source cell, next to "Public link / Researcher runtime", using the same outline Badge style. No new column. KPIs stay unchanged.

## 4. ApiDocs.tsx
Inside the existing submit-conversation-audio section, using the existing table/code-block styles, add:
- Optional params: `uniqueid` (ViciDial `--A--uniqueid--B--`, up to 64 characters) and `leadId` (up to 64).
- A "Linking" note: one record per call, holding typed answers plus the recording. A repeat post of the same uniqueid returns 200 `{ success, duplicate: true, bookingId, researchCallId }` and writes nothing.
- Response field `linked`: `'uid' | 'fallback' | null`.
- The screen-pop URL format.

All existing content is kept.

## 5. ScriptBuilder.tsx External Link popover
Below the existing link box, add a second label "ViciDial Screen-Pop URL". It uses the same `bg-muted font-mono break-all` box and shows:
`{getScriptPublicUrl(token.token)}?uid=--A--uniqueid--B--&lead=--A--lead_id--B--&phone=--A--phone_number--B--&agent=--A--user--B--&campaign=--A--campaign--B--`
It gets a "Copy Screen-Pop URL" outline button that follows the existing `navigator.clipboard` and `toast.success` pattern. Below that sits one line of help text: "Add `uniqueid` to the recording POST so the form and the recording link to the same call."

## Verification
- `tsgo --noEmit -p tsconfig.app.json`, then check the build log.
- Browser: open a public script URL with and without odd parameters (long, unicode, HTML). Confirm the page renders unchanged and the parameters appear in no visible text. Inspect the request body only for key presence, never printing values.
- Check the Reports research view, Submissions tab, API Docs and ScriptBuilder popover as super_admin.
- Real saves or recordings are not submitted. Nothing is published.
