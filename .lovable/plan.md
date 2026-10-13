# Plan: BUG-009 capture file (drift #54)

## Goal
Record a database rule that was already applied directly to production as a plain file in the repo. The file is written and never executed.

## Action
Create exactly one new file:

`supabase/migrations/20261013130000_capture_bug009_supervisor_read_scripts.sql`

with exactly this content (2 lines, one trailing newline, byte for byte):

```sql
-- Capture of drift #54 (BUG-009), applied directly on 2026-10-13.
CREATE POLICY "Supervisors can view active scripts" ON public.research_scripts FOR SELECT TO authenticated USING (has_role(auth.uid(), 'supervisor'::app_role) AND is_active = true);
```

## What will NOT happen
- No migration tool used; no SQL executed; the database is untouched.
- No `types.ts` regeneration, no deploy, no publish.
- No other file created, edited, or deleted: nothing under `src/`, no edge functions, no roadmap or other notes.
- `Leaderboard.tsx`, `SiteFilter.tsx`, `useAgentGoals.ts` are not touched.

## Verification
After writing, report `wc -l` and `md5sum` of the file. Expected:
- 2 lines
- md5 `8e3b172e544ac802a2275c1d160bd548`
