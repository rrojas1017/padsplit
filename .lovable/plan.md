
## Feature: Highlight Concerns Flagging Records in Call Insights

### Problem
When users see "detected issues" in Reports or Call Insights, they don't know *which specific concerns or objections* triggered each issue detection. The current implementation only shows the category name (e.g., "Payment & Pricing Confusion"), but the AI agent needs to understand what member feedback triggered the classification.

### Solution Overview
We need to modify the issue classification logic to also track and display the **matching keywords/concerns** that flagged each issue. This requires:

1. **Enhanced Issue Detection Data Structure**
   - Instead of storing just `["Payment & Pricing Confusion"]`, store rich data like:
   ```typescript
   {
     issue: "Payment & Pricing Confusion",
     matchingKeywords: ["promo code", "deposit"],
     matchingConcerns: ["Customer asked about promo codes", "Concerned about deposit amount"]
   }
   ```

2. **Update Backend Classification Logic**
   - Modify `supabase/functions/transcribe-call/index.ts` to collect matching keywords and map them back to the original memberConcerns/objections
   - Modify `supabase/functions/backfill-detected-issues/index.ts` to apply the same logic
   - Modify `src/utils/issueClassifier.ts` to return enhanced issue objects with matching details

3. **Database Schema Migration**
   - Update the `bookings` table to store the enhanced issue data structure in `detected_issues` as a JSONB array of objects instead of a simple array of strings

4. **UI Display Updates**
   - **Reports Page**: When users hover over the issue badge, show not just the category but also the specific concerns/keywords that triggered it
   - **TranscriptionModal**: Add a new "Flagged Issues" section that lists each detected issue with its matching concerns highlighted
   - Create an expandable "Issue Details" card that shows:
     - Issue category name
     - Keywords from our classifier that matched
     - The actual member concerns/objections that contained those keywords

5. **Backward Compatibility**
   - The current simple string array format is still in use; we need to handle both old format (for existing records) and new format (for new classifications)
   - UI components should gracefully handle both

### Implementation Steps

1. **Create database migration** to alter `bookings` table: change `detected_issues` from `text[]` to `jsonb` to support richer data structure

2. **Update `src/utils/issueClassifier.ts`**:
   - Add new function `classifyIssuesWithDetails()` that returns objects with `{ issue, matchingKeywords, matchingConcerns }`
   - Keep existing `classifyIssues()` for backward compatibility

3. **Update edge functions** (both `transcribe-call` and `backfill-detected-issues`):
   - Use the new `classifyIssuesWithDetails()` function
   - Store enhanced objects in database

4. **Update Reports.tsx**:
   - Enhance the issue tooltip to show matching keywords and concerns
   - Add icons/visual indicators for each issue category

5. **Update TranscriptionModal.tsx**:
   - Add new "Detected Issues & Concerns" section
   - Display each issue with its triggering keywords/concerns in an expandable format
   - Use the ISSUE_BADGE_CONFIG colors for visual consistency

6. **Re-run backfill**:
   - After deploying updated functions, reset `detected_issues` to NULL
   - Run backfill to populate all records with enhanced issue data

### Expected Outcome

When users view a record in Reports or the Call Insights modal:
- **Reports page**: Hovering over issue badge shows full issue name + list of concerns that triggered it
- **TranscriptionModal**: New "Flagged Issues" panel shows each issue category with:
  - The category icon and badge color
  - List of keywords that matched
  - The specific member concerns/objections that contained those keywords
  - This helps agents understand *why* the system flagged this record and what to address

### Files to Modify

1. **Database**: Create migration for `detected_issues` JSONB structure
2. **`src/utils/issueClassifier.ts`** -- Add `classifyIssuesWithDetails()` function
3. **`supabase/functions/transcribe-call/index.ts`** -- Use new classification function
4. **`supabase/functions/backfill-detected-issues/index.ts`** -- Use new classification function
5. **`src/pages/Reports.tsx`** -- Enhanced tooltip with matching concerns
6. **`src/components/booking/TranscriptionModal.tsx`** -- New "Detected Issues" section

