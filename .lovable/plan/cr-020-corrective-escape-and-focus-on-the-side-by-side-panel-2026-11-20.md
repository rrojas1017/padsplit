# CR-020 corrective: Escape and focus on the side-by-side panels

## What changes for the user
- Every Escape press closes exactly one panel: the call panel first if it is open, otherwise the respondents list.
- After "Open call" on another row, focus moves into the call panel, the same as on the first open.
- When the call panel closes, focus goes back to the "Open call" button of the row whose call was just open. If that row is no longer shown, focus goes to the respondents list.

## Files
1. `src/components/research-insights/ScriptSurveyInsightsDashboard.tsx`
   - One document `keydown` listener, active only while the list or a call is open. Escape (when no transcript window is open) runs: `preventDefault` + `stopPropagation`. Then if a call is open, close the call; else if a list is open, close the list.
   - Keep track of which booking each call was opened from, not of the button element. `openCall(r)` saves `r.booking_id` every time.
   - Focus into the call panel after every open and every swap: on the next frame, focus the call panel's title or Close button, through an element id or ref.
   - When the call closes: find the matching "Open call" button (`[data-open-call="<booking_id>"]`) inside the list. Focus it if it exists, else focus the list panel. When there is no list (opened from Written answers), use the element saved when that call opened.
   - Pass `onEscapeKeyDown={e => e.preventDefault()}` to both panels so they don't also close themselves.
2. `src/components/research-insights/script-survey/RespondentsSheet.tsx`: new optional `onEscapeKeyDown` prop passed to the panel. Each "Open call" button gets a `data-open-call={booking_id}` attribute. That attribute holds an internal id only, never a name or phone. The list panel gets an id so it can receive focus.
3. `src/components/reports/ResearchCallPanel.tsx`: new optional `onEscapeKeyDown` and `contentId` props. If you don't pass them, it behaves exactly as today, so Reports is unaffected.
4. `src/components/research-insights/script-survey/ScriptSurveyResponsesTab.tsx`: no change expected. The focus fallback for Written answers is handled in the dashboard.

## Not changing
Anything else from CR-020, Reports, the URL, and rules R1–R4. No new data reads, no database changes, nothing in the console. Nothing is published.

## Verification
- Run `tsgo --noEmit -p tsconfig.app.json` and `bun test src`.
- Playwright at 1920px, signed in, on Member Screening:
  - Open → Esc → Esc closes the call, then the list.
  - Swap → Esc closes only the call.
  - The focused element after a swap is inside the call panel.
  - After closing the call, the focused element is that row's button.
- Report the changed files.
