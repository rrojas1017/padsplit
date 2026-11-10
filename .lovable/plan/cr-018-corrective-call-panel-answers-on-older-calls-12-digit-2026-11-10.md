# CR-018 corrective — call panel answers on older calls + 12-digit phones

Frontend only. No database, function, RLS or other behaviour change.

## 1) Call panel "Not answered" on map-keyed answers
File: `src/hooks/useResearchCallAnswers.ts` (`buildAnswerGroups`)
- Build a list of `{ key, entry }` pairs from `raw`:
  - raw is a plain object (not array): one pair per map entry, key = map key.
  - raw is an array: key = `question_id` (or null).
- `byId`: first set every entry by its `question_id` when present, then set by map key (so the map key wins on conflict). Arrays keep using `question_id` only.
- Unresolved-script fallback list: label = `question_text`, else the map key, else `Question N`; item key = map key ?? question_id ?? index.
- Answer rendering (`answerString`) unchanged.

Test: new `src/hooks/useResearchCallAnswers.test.ts`
- Map `{ q1: { selected_options: ['Yes'] }, q2: { answer_text: 'Too far' } }` (no `question_id`) with script questions q1/q2 → answers "Yes" / "Too far", not "Not answered".
- Same map with no script → fallback labels "q1"/"q2".
- Conflict: map key `q1` holding `question_id: 'q2'` → shown under q1.
- Array input still matched by `question_id`.

## 2) Phones like "+119569541807"
File: `src/utils/callerIdentity.ts` (`formatCallerPhone`)
- After keeping digits, strip leading "1"s while length > 10 (replaces the current single 11-digit rule). If exactly 10 remain → `(956) 954-1807`; otherwise return the original trimmed value.

Tests in `src/utils/callerIdentity.test.ts`: add "+119569541807" → "(956) 954-1807"; existing tests must keep passing.

## Checks
`tsgo --noEmit -p tsconfig.app.json`, run both test files. Nothing published.
