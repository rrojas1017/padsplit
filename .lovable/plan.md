# CR-020 follow-up: stop reloading survey data when the transcript closes

## Change (one file, one line)
`src/components/research-insights/ScriptSurveyInsightsDashboard.tsx`, line 486:
- Today: `onClose={() => { setTranscriptRecord(null); refetch(); }}`
- After: `onClose={() => setTranscriptRecord(null)}`

Line 487 stays as it is: `onTranscriptionComplete={() => { refetch(); }}`. That is still the only place the data reloads.

## Not changing
Everything else in the app, the database, and the published site. Nothing is published.

## Verification
- Run `tsgo --noEmit -p tsconfig.app.json`
- Run the existing test files (vitest)
- Report the list of changed files (expected: only the file above)
