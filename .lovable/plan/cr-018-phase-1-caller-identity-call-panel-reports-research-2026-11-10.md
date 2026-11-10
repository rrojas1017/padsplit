# CR-018 phase 1 — Caller identity + call panel (Reports › Research)

Frontend only. No database, migration, SQL, function, RLS, route or dependency change. Nothing published.

## What the user sees
- Research table "Name" column shows the caller: real name, else formatted phone, else "Unknown caller". Placeholders ("API Submission…", "Public Submission…") never appear as a name.
- Clicking a research row (outside its existing buttons/links/hover-card triggers) opens a right-side panel: identity, phone under it, call date, agent, survey name, duration (m:ss), the existing Transcript action (same modal, which already plays the recording), and an "Answers" list in script order.
- `?booking=<id>` on Reports opens the Research tab with that call's panel; closing the panel removes the parameter.

## Files

1. **New `src/utils/callerIdentity.ts`** (pure, reusable by phase 2)
   - `isRealCallerName(name)` — non-empty after trim, not starting with "API Submission"/"Public Submission" (case-insensitive).
   - `formatCallerPhone(phone)` — digits only; 10 → `(404) 281-7603`; 11 starting with 1 → same without the 1; otherwise original trimmed; empty → null.
   - `callerIdentity({ name, phone })` → `{ primary, secondary }` exactly per R1.

2. **New `src/utils/callerIdentity.test.ts`** — one test per R1 rule (placeholders rejected incl. lowercase, 10/11/other/empty phone, primary/secondary combinations). Run with the repo's existing test runner.

3. **New `src/hooks/useResearchCallAnswers.ts`** — runs only when the panel is open (`enabled` = booking id present).
   - Reads `booking_transcriptions.research_extraction, research_campaign_type` for the booking (RLS-readable, same table Reports joins).
   - Resolves the script: (a) `research_calls.script_id` via the booking's `research_call_id` if readable (Reports already reads `research_calls`); (b) else the single active `research_scripts` row whose `resolveResearchCampaignType` equals the booking's campaign type; (c) else unresolved.
   - Returns ordered rows: script questions in order, skipping `is_internal`; grid rows grouped under the grid title (via `scriptMatrix` helpers) with each row labeled by its row text. Answer text: choice/multi-select = labels joined ", "; scale = number; open-ended = text; missing = null ("Not answered").
   - Unresolved script → stored `raw_script_answers` in stored order using `question_text`. No answers → empty state flag.
   - Never reads or exposes `source`; no console output except a code-only warn on query failure (no data, no PII).

4. **New `src/components/reports/ResearchCallPanel.tsx`** — shadcn `Sheet` (right side).
   - Header: `primary` (large), `secondary` muted; date, agent name (`getAgentName`), survey label (`researchCampaignLabel`), duration m:ss.
   - Transcript button: calls back to Reports to open the existing `TranscriptionModal` exactly as the table button does (shown under the same condition).
   - Answers list / "Not answered" muted / "No survey answers for this call." Read-only, no source labels or badges (R2).
   - Respects existing contact masking: phone shown via `maskPhone` when `shouldMaskContactInfo(role)` is true.

5. **Edit `src/pages/Reports.tsx`** (research view only)
   - Name cell: render `callerIdentity({ name: memberName, phone: contactPhone }).primary`, keeping the existing `ContactProfileHoverCard` wrapper when a real name exists (phone fallback respects masking). Contact column, CSV, badges, other columns unchanged.
   - Research `<tr>`: `onClick` opens the panel unless the click target is inside `a, button, [role=button], input, [data-no-row-click]`; add `cursor-pointer`.
   - `useSearchParams`: on load, if `booking` is present, switch to the Research tab and open the panel; if the booking isn't on the current page, fetch that single row from `bookings` (`record_type = 'research'`, same columns/transform used by Reports) — not found/denied → drop the param silently. Opening a row sets `?booking=<id>`; closing removes it (replace, no history spam). Only the id goes in the URL.
   - Transcript from the panel reuses `setSelectedBooking` + `setShowTranscriptModal`.

## Not changed
Bookings tab, filters, KPI cards, pagination, sorting, CSV export, intake/outcome badges, other columns, other pages/dashboards, auth, routes, `useReportsData` queries for the table.

## Checks
`tsgo --noEmit -p tsconfig.app.json`; run `callerIdentity.test.ts`; Playwright as an admin: row click opens panel, answers render, `?booking=` deep link opens and closing clears it, no PII in URL/console.
