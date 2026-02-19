
## Fix: Import Dialog Field Mismatch

### Root Cause

The `parse-research-script` edge function is working correctly (confirmed by direct test — it returns valid data). The problem is a field name mismatch in `ResearchScriptImportDialog.tsx`:

- The edge function normalizes questions and returns each question's text in the **`text`** field (e.g., `q.text = "What is your name?"`)
- The import dialog maps `q.question` on line 57, which is `undefined` because the edge function used `text` not `question`
- This `undefined` value then causes the `.trim()` crash in `ResearchScriptDialog.tsx` (the bug fixed in the last message)
- Additionally, `fnError` from `supabase.functions.invoke` triggers when there's a network/CORS issue before the function even responds — the error message "Failed to send a request to the Edge Function" is the Supabase client's generic message for this case, likely caused by the function timing out on a large document

### What Needs To Change

**File: `src/components/research/ResearchScriptImportDialog.tsx`** — line 57

Change:
```typescript
question: q.question,
```
To:
```typescript
question: q.text || q.question || '',
```

This ensures the dialog correctly reads the question text regardless of which field name the edge function used, and never passes `undefined` into the script editor (preventing the `.trim()` crash).

Also pass through the richer fields (`section`, `probes`, `branch`, `is_internal`) from the edge function so they aren't lost when the script is saved. The `ScriptQuestion` type in `useResearchScripts.ts` should be extended to include these optional fields so the full data round-trips correctly.

### Files To Change

1. **`src/components/research/ResearchScriptImportDialog.tsx`** — Fix question mapping to read `q.text || q.question` and pass through `section`, `probes`, `branch`, `is_internal` fields
2. **`src/hooks/useResearchScripts.ts`** — Extend `ScriptQuestion` interface to include `section?`, `probes?`, `branch?`, `is_internal?` optional fields so the richer data parsed by AI is preserved when saved to the database
