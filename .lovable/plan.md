

# Dynamic Script Reporting — Adapted Plan

## Key Finding from Code Review

**There is no `research_script_questions` table.** Questions are stored as a JSONB array in `research_scripts.questions`. The user's plan assumed a separate questions table — we need to adapt everything to work with the existing JSONB structure.

Each question in the JSONB array looks like:
```json
{ "order": 1, "question": "...", "type": "open_ended|multiple_choice|yes_no|scale", "options": [...], "section": "...", "required": true }
```

## Database Migration

### 1. Create `script_responses` table (simplified — no FK to questions table)

```sql
CREATE TABLE public.script_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES public.research_scripts(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  question_order INTEGER NOT NULL,        -- maps to questions[].order in the JSONB
  response_value TEXT,
  response_options TEXT[],
  response_numeric NUMERIC,
  respondent_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_script_responses_script ON public.script_responses(script_id);
CREATE INDEX idx_script_responses_session ON public.script_responses(session_id);

ALTER TABLE public.script_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage script_responses" ON public.script_responses
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read script_responses" ON public.script_responses
  FOR SELECT TO authenticated USING (true);
```

### 2. Add tracking columns to `research_scripts`

```sql
ALTER TABLE public.research_scripts
  ADD COLUMN IF NOT EXISTS total_responses INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_response_at TIMESTAMPTZ;
```

## New Files

| File | Purpose |
|------|---------|
| `src/pages/ScriptResults.tsx` | Dynamic results page — reads questions from `research_scripts.questions` JSONB, responses from `script_responses` |
| `src/components/research/DynamicQuestionCard.tsx` | Renders chart per question type (bar for choice, histogram for scale, pills for yes/no, theme list for open-ended) |
| `src/components/research/ScriptResultsOverview.tsx` | KPI cards: total responses, completion rate, avg rating, response trend chart |
| `src/utils/generateDynamicReport.ts` | .docx executive report generator — reads questions dynamically, builds per-question tables |

## Modified Files

| File | Change |
|------|--------|
| `src/App.tsx` | Add route `/research/scripts/:scriptId/results` |
| `src/pages/research/ScriptBuilder.tsx` | Add "View Results" button on each script card |

## How It Works

1. Questions come from `research_scripts.questions` JSONB — no separate table needed
2. Responses stored in `script_responses` with `question_order` matching the JSONB `order` field
3. The results page joins them: fetch script → extract questions array → fetch responses → group by `question_order`
4. Chart type is determined by `question.type`: `scale` → histogram, `multiple_choice` → horizontal bar, `yes_no` → pills, `open_ended` → theme tags with expandable raw list
5. The .docx report iterates the same data dynamically — no hardcoded question map

## Technical Details

- Uses `recharts` (already in project) for all charts
- `docx` + `file-saver` (already in project) for Word export
- Response grouping: `responses.filter(r => r.question_order === q.order)`
- Unique sessions = `new Set(responses.map(r => r.session_id)).size`
- Completion rate = sessions answering 80%+ of questions
- Route is protected for `super_admin` and `admin` roles

