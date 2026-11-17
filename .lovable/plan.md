# CR-019 follow-up — grid "Other" column with a literal "Other" option

## Fix (one line)
`src/utils/scriptSurveyRespondents.ts` › `respondentsForGridCell`: for `column === GRID_OTHER` return
`matched.includes(GRID_OTHER) || unmatched.length > 0`. Nothing else changes.

This lines up with the grid card. When the options include "Other", `buildGridModel` counts both kinds of answer in that column: the people who picked "Other" (matched) and the people whose answer matched no option (folded into "Other" by `splitAnswerLabels`).

## Test
`src/utils/scriptSurveyOptionMatch.test.ts` gets one new test: a grid row with options `['Yes','No','Other']` and three records: one picked "Other", one answered "Kind of", one picked "Yes".
- For every segment, `respondentsForGridCell(...).length === seg.count`.
- The Other segment count is 2.
- `unmatchedAnswerText` returns "Kind of" for the free-text record and `null` for the record that picked "Other".

## Scope
Only these two files change. No database change. Nothing published. Afterwards I run `bun test src/utils src/hooks` and `tsgo --noEmit -p tsconfig.app.json` and report the results.
