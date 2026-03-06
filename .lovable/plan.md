

## Fix: `research_insights_insight_type_check` constraint violation

**Problem**: The `generate-research-insights` edge function inserts `insight_type: 'aggregate'`, but the database check constraint only allows: `nps`, `sentiment`, `themes`, `competitors`, `features`, `recommendations`, `summary`.

**Fix**: Add `'aggregate'` to the check constraint via a database migration.

### Steps

1. **Database migration** -- Drop and recreate the check constraint to include `'aggregate'`:
   ```sql
   ALTER TABLE research_insights DROP CONSTRAINT research_insights_insight_type_check;
   ALTER TABLE research_insights ADD CONSTRAINT research_insights_insight_type_check 
     CHECK (insight_type = ANY (ARRAY['nps','sentiment','themes','competitors','features','recommendations','summary','aggregate']));
   ```

No code changes needed -- the edge function already uses `'aggregate'` correctly; it's just blocked by the constraint.

