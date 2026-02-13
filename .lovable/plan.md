

# Fix: Issue Filter Not Working After JSONB Migration

## Problem

The `detected_issues` column was recently migrated from `text[]` to `jsonb` (array of objects). The Reports page filter still uses Supabase's `.overlaps()` operator, which compares flat arrays. Since the column now stores objects like:

```json
[{"issue": "Payment & Pricing Confusion", "matchingKeywords": [...], "matchingConcerns": [...]}]
```

The filter `query.overlaps('detected_issues', ['Payment & Pricing Confusion'])` never matches, so no filtering occurs.

## Solution

Create a database function that checks if any object in the JSONB array has an `issue` field matching one of the selected filter values, then call it from the query.

### Step 1: Database Migration

Create a SQL function `has_detected_issue` that accepts a JSONB column value and an array of issue names, and returns true if any object's `issue` field is in the list:

```sql
CREATE OR REPLACE FUNCTION public.has_detected_issues(
  issues jsonb,
  filter_values text[]
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF issues IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1
    FROM jsonb_array_elements(issues) elem
    WHERE elem->>'issue' = ANY(filter_values)
  );
END;
$$;
```

### Step 2: Update `src/hooks/useReportsData.ts`

Replace the `.overlaps()` call (line 287-289) with an `.rpc` filter or a raw `.filter()` call that invokes the new function:

```typescript
// Before (broken):
query = query.overlaps('detected_issues', filters.issueFilter);

// After (working):
query = query.filter(
  'has_detected_issues(detected_issues, array[' +
  filters.issueFilter.map(i => `'${i}'`).join(',') +
  '])',
  'eq',
  true
);
```

Alternatively, use PostgREST's built-in `cs` or a simpler approach: since PostgREST doesn't natively support custom function filters inline, we can use `.or()` with `detected_issues.cs` on each value wrapped as a JSONB contains check:

```typescript
const issueConditions = filters.issueFilter
  .map(issue => `detected_issues.cs.[{"issue":"${issue}"}]`)
  .join(',');
query = query.or(issueConditions);
```

This uses the `@>` (contains) operator: checking if the JSONB array contains at least one object with a matching `issue` field. This approach requires no database function.

## Files to Modify

1. **`src/hooks/useReportsData.ts`** (line 287-289) -- Replace `.overlaps()` with `.or()` using JSONB contains (`cs`) checks for each selected issue category

## Technical Detail

The PostgREST `cs` (contains) operator maps to PostgreSQL's `@>`. So `detected_issues.cs.[{"issue":"Payment & Pricing Confusion"}]` translates to:

```sql
detected_issues @> '[{"issue":"Payment & Pricing Confusion"}]'::jsonb
```

This correctly matches any row where the JSONB array includes an object with that issue name, regardless of other fields in the object.
