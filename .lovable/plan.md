

# Enable Issue Detection for Research Calls

## Root Cause
The `classifyIssuesFromKeyPoints` function runs on all records including research, but the keyword dictionary only covers sales-call themes (pricing confusion, booking process, move-in barriers). Research calls surface fundamentally different issues — property conditions, host accountability, safety — that have zero keyword overlap with the current categories.

## Solution: Add Research-Relevant Issue Categories

Add new issue categories to the classifier that capture research call themes. This requires updating three places that share the same keyword dictionary:

### New Categories

| Category | Sample Keywords |
|---|---|
| Property Condition Issues | bed bugs, mold, plumbing, pipes, no heat, no water, broken, roach, pest, infest, not maintained, not up to par |
| Host & Maintenance Failures | host not responsive, maintenance never, didn't fix, failed to repair, no response from host, took weeks, never came |
| Safety & Security Concerns | police, unsafe, harassment, unauthorized, break-in, crime, dangerous, afraid, threatened |
| Rent & Affordability Pressure | rent increase, couldn't afford rent, price went up, too expensive to stay, eviction |

### Files to Update

1. **`src/utils/issueClassifier.ts`** — Add new categories to `ISSUE_CATEGORIES`, `ISSUE_BADGE_CONFIG`, and `ISSUE_KEYWORDS`
2. **`supabase/functions/transcribe-call/index.ts`** — Add same new categories to the inline `ISSUE_KEYWORDS` dictionary
3. **`supabase/functions/backfill-detected-issues/index.ts`** — Add same new categories to its inline dictionary

### Badge Colors for New Categories

- Property Condition Issues: `bg-yellow-500/15 text-yellow-600` with `Bug` icon
- Host & Maintenance Failures: `bg-orange-500/15 text-orange-600` with `Wrench` icon
- Safety & Security Concerns: `bg-red-500/15 text-red-700` with `AlertTriangle` icon
- Rent & Affordability Pressure: `bg-pink-500/15 text-pink-600` with `TrendingUp` icon

### Backfill
After deploying, run the existing `backfill-detected-issues` function to retroactively tag the 89 valid-conversation research records (and re-check the 1,443 invalid ones).

### No Schema Changes
`detected_issues` is already a JSONB column — new category strings work without migration.

