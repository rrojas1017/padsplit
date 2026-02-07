

# Fix: Update Database Constraint for New Date Periods

## Problem
When you select **"This Week"** and click "Run Analysis", the backend function fails with:

```
new row for relation "member_insights" violates check constraint "member_insights_analysis_period_check"
```

The database has a check constraint that only allows certain values for `analysis_period`. The new period values we added (`thisWeek`, `lastMonth`) are **not in the allowed list**.

## Current Allowed Values
```
weekly, monthly, manual, last7days, last30days, thisMonth, last3months, allTime
```

## Missing Values
- `thisWeek` (needed for "This Week" filter)
- `lastMonth` (needed for "Last Month" filter)

---

## Solution

Update the database constraint to include the new period values.

### Database Migration
```sql
-- Drop the existing constraint
ALTER TABLE member_insights 
DROP CONSTRAINT member_insights_analysis_period_check;

-- Add updated constraint with new period values
ALTER TABLE member_insights 
ADD CONSTRAINT member_insights_analysis_period_check 
CHECK (analysis_period = ANY (ARRAY[
  'weekly', 'monthly', 'manual',           -- legacy values
  'last7days', 'last30days',               -- old values (backward compat)
  'thisWeek', 'lastMonth', 'thisMonth',    -- calendar-accurate periods
  'last3months', 'allTime'                 -- existing values
]));
```

---

## Files Changed
- **Database only** - No code changes needed

## Expected Result
After the migration:
- "This Week" analysis will work correctly
- "Last Month" analysis will work correctly
- All existing records remain valid
- Backward compatibility maintained for old period values

