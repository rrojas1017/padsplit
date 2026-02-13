
## Feature: Align Non-Booking Insights Frequencies with Issue Classifier

### Problem Analysis

The `analyze-non-booking-insights` edge function currently:
- **Pre-aggregates objections** into semantic categories (Timing/Not Ready, Financial Constraints, etc.)
- **Sends objection counts to AI** for analysis
- **Does NOT anchor frequencies** to the keyword-based issue classifier used in Reports

This mirrors the original problem with Booking Insights: objection categories may include both genuine barriers and routine mentions, inflating frequency percentages.

### Solution Overview

Apply the **same hybrid analysis pattern** recently implemented in `analyze-member-insights`:
1. **Pre-compute hard counts** from the keyword classifier (same `classifyBookingIssues` logic)
2. **Pass reference frequencies** to the AI as "GROUND TRUTH"
3. **Instruct the AI** to anchor objection pattern frequencies to these classifier counts
4. **Maintain narrative synthesis** for recovery recommendations and agent insights

### Implementation Approach

**Step 1: Import Keyword Classifier Logic**
- Inline the `ISSUE_KEYWORDS` and `classifyBookingIssues` function into `analyze-non-booking-insights/index.ts` (same as done for `analyze-member-insights`)
- Pre-compute issue frequencies from bookings before calling AI

**Step 2: Update AI Prompt**
- Add a "KEYWORD CLASSIFIER REFERENCE FREQUENCIES" section (modeled after `analyze-member-insights` prompt)
- Add explicit instructions:
  ```
  CRITICAL FREQUENCY INSTRUCTIONS:
  - Your objection_patterns frequency percentages MUST closely align with the keyword classifier counts below.
  - Do NOT estimate higher frequencies based on mentions alone.
  - Only count calls where the topic was a GENUINE BARRIER or source of CONFUSION/FRUSTRATION.
  ```
- Include example distinction pairs for each major objection category

**Step 3: Merge Hard Counts with AI Output**
- Compute frequencies from the keyword classifier before AI analysis
- Pass these as reference data in the prompt
- AI focuses on narrative synthesis (suggested responses, recovery recommendations) while respecting the pre-computed frequencies

### Technical Details

**Files to Modify:**
1. **`supabase/functions/analyze-non-booking-insights/index.ts`**
   - Inline `ISSUE_KEYWORDS` and `classifyBookingIssues` function (lines ~16-35 will be replaced with full logic)
   - Add pre-computation of issue frequencies before the AI call (after line 215, before prompt construction)
   - Update the prompt template (lines ~233-255) to include keyword classifier reference section
   - Add explicit distinction examples for each major category

### Expected Outcome

- **Before**: Objection patterns may show inflated percentages based on topic mentions
- **After**: Objection patterns reflect only genuine barriers/confusion, anchored to keyword classifier
- **Consistency**: Non-Booking objection frequencies now align with the Reports page's strict classification
- **Quality**: AI synthesis remains valuable but is grounded in factual keyword-based counts

### Backward Compatibility

- Existing non-booking insights records remain unchanged
- New analyses will use the updated prompt with keyword classifier anchoring
- No database schema changes needed

### Implementation Notes

Since Edge Functions cannot import from the React project's `/src` directory, the `ISSUE_KEYWORDS` and `classifyBookingIssues` function will be fully inlined into the edge function (just as done for `analyze-member-insights`).

The hybrid pattern ensures:
- **100% factual accuracy** on frequency metrics (from keyword classifier)
- **High-quality narrative insights** from AI (improvement areas, responses, market focus)
- **Clear alignment** with the Reports page classifier across all insights pages
