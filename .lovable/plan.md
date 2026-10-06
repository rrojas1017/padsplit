# CR-012 corrective — show the current outcome instead of the first disposition

## Files touched (exactly three)
1. `src/pages/PublicScriptView.tsx`
2. `src/components/research-insights/ScriptInsightsPanel.tsx`
3. `src/pages/Reports.tsx`

Nothing else changes: no edge functions, save queue, data hooks, database or `types.ts`. Nothing published.

## 1. Agent form, Done screen
In the "Call Ended Early" block, the `<p>Disposition: …</p>` line becomes `{!hasOutcomes && (<p>…</p>)}` with the markup unchanged. When the script has outcomes, the "How did the call end?" list already shows the current choice. Scripts without outcomes render exactly as today.

## 2. Submissions tab, "Early-end reason" cell
Today it reads `r.call_outcome === "ended_early" ? (earlyDisposition(r.responses) ?? "—") : "—"`. It becomes `r.call_outcome === "ended_early" ? (r.close_outcome_label || earlyDisposition(r.responses) || "—") : "—"`. The "Call outcome" column stays.

The `??` becomes `||`, but the output can't change: `earlyDisposition()` only returns a trimmed, non-empty string or null, so rows without a label show exactly what they show today.

## 3. Reports › Research, "Ended early" tooltip
The tooltip does show disposition text today: `{p.disposition || 'No disposition'} · answered/total`. It becomes `{researchOutcomeById[booking.id] || p.disposition || 'No disposition'} · …`. The badge text "Ended early" and when it appears stay the same. Rows without an outcome render exactly as before.

## Verification
`tsgo --noEmit -p tsconfig.app.json` clean.
