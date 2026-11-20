# CR-020 — "Open call" opens the call panel beside the respondents list

Frontend only. No database, function, RPC or URL change. Nothing published. Base: `a75a32af`.

## What the user will see
- **Open call:** on the 30-Day, Non-Booking and Member Screening dashboards, "Open call" in the "N respondents — answer" list keeps you in Research Insights.
- **Wide screens (1024px and up):** the call panel opens at the right edge and the respondents list slides left to sit next to it. One dim background covers the page behind both.
- **Narrower screens:** the call panel covers the list. Closing it brings the list back exactly as it was: same scroll position and same "Show more" count.
- **Inside the list:**
  - The row whose call is open is shaded and its button reads "Viewing".
  - "Open call" on another row just swaps the call.
  - Scrolling the list or using "Show more" never closes the call.
- **Closing:**
  - Escape closes the call first, then the list.
  - The call's X closes only the call, and the list slides back to the right edge.
  - The list's X, or a click on the dim area outside both panels, closes both.
- **Written answers (Script Responses tab):** clicking the "name · date" line opens the same call panel on its own, without leaving the page.
- **Transcript:** the button opens the usual transcript window above both panels. Its title shows the same name, or the same phone number or "Unknown caller", as the panel header, never "API Submission…". Closing it leaves both panels as they were.
- **Reports › Research:** works exactly as today, including the `?booking=` link.

## How (technical)
- **`src/components/ui/sheet.tsx`:** optional `hideOverlay?: boolean` on `SheetContent` (default false, so every current use is unchanged). This keeps a single dim background when two panels are open.
- **`src/components/reports/ResearchCallPanel.tsx`:** reused, not copied. New optional props, each defaulting to today's behaviour:
  - `hideOverlay?`
  - `onPointerDownOutside?` (passed to SheetContent): clicks inside the list don't close the call; a click on the dim area closes both.
  - `className?`, so the panel can sit above the list.
  - The Reports call site is untouched.
- **`src/utils/scriptSurveyCallBooking.ts` (new, pure):** `recordToPanelBooking(record, { identityText, agentName, surveyLabel })` builds the panel's `Booking` from the already-loaded record:
  - Fields: `id` = booking_id, booking_date (parsed as an ET calendar day), call_duration_seconds, kixie_link, transcription_status, research_call_id, contact_phone and agent_id.
  - `memberName` = `identityText`, the same text shown in the header (real name, else formatted or masked phone, else "Unknown caller").
  - The other required `Booking` fields get neutral values (Research type and status).
  - No new query, no RPC.
- **`src/components/research-insights/script-survey/RespondentsSheet.tsx`:**
  - "Open call" calls a new `onOpenCall(record, triggerEl)` prop instead of navigating.
  - New props `activeBookingId` (row shading plus "Viewing") and `shifted` (adds `lg:right-[32rem]` with a short transition).
  - Its own Escape and outside-click behaviour is unchanged. Radix layers already give Escape to the topmost panel, and focus returns to the row's button when the call closes.
  - "Other" panels still show each person's own words.
- **`src/components/research-insights/script-survey/ScriptSurveyResponsesTab.tsx`:** the `WrittenAnswers` "name · date" line calls an optional `onOpenCall` prop, passed down from the dashboard, instead of navigating.
- **`src/components/research-insights/ScriptSurveyInsightsDashboard.tsx`:** owns `callRecord` and transcript state.
  - It renders one `ResearchCallPanel` (`hideOverlay` when the list is open), with agent name from `useAgents`, survey = the current script's name and `maskContact = shouldMaskContactInfo(user.role)`.
  - It renders one `TranscriptionModal` built through `recordToPanelBooking`; its `onTranscriptionComplete` refetches the survey data.
  - Closing the list also closes the call.
- **`src/components/booking/TranscriptionModal.tsx`:** remove only the `console.log('Booking update received:', payload)` line.
- **`src/utils/scriptSurveyCallBooking.test.ts` (new):**
  - field mapping
  - a placeholder name ("API Submission …") becomes the formatted phone
  - a masked user gets the masked phone
  - no name and no phone gives "Unknown caller"

## Rules kept
- **R1:** identity through `callerIdentity` plus the existing masking.
- **R2:** no source labels.
- **R3:** only records already loaded; no new read; supervisors keep their site scope.
- **R4:** no URL change, nothing logged.
- Dashboard numbers, filters, CSV, the Word brief and the other dashboards are unchanged.

## Verification
Run `tsgo --noEmit -p tsconfig.app.json` and all existing tests plus the new one, then do a signed-in browser check at 1280px and 800px (open list → Open call → swap → Escape twice) and report the list of changed files.
