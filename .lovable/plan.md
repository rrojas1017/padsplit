

## Fix: Overhaul Issue Classification to Reduce False Positives

### Problem

The current keyword-based issue classifier produces **massively inflated results**:
- 75% of records are tagged with 5+ issues (out of 8 possible)
- 320 records are tagged with ALL 8 issues
- Only 140 records have just 1 issue

This happens because single generic words like "room", "booking", "pay", "wait", "host", "location", "document", and "ready" trigger entire categories. In a housing/booking context, these words appear in virtually every call regardless of whether an actual issue exists.

### Root Cause

The classifier uses a naive `string.includes(keyword)` approach:
1. It concatenates ALL text fields (summary, concerns, objections, preferences) into one blob
2. A single keyword match anywhere in that blob activates the entire category
3. Keywords are too generic for a housing/booking domain (e.g., "room" will always appear)

### Solution: Contextual Keyword Refinement

#### Phase 1: Tighten Keywords (all 3 files)

Remove overly generic single words and replace them with more specific phrases that indicate an actual **problem** rather than a normal conversation topic.

**Changes per category:**

| Category | Remove (too generic) | Keep / Add (specific to actual issues) |
|---|---|---|
| Payment & Pricing Confusion | `pay`, `cost`, `price`, `fee`, `charge` | Keep: `promo code`, `deposit`, `how much`, `move-in cost`. Add: `overcharged`, `hidden fee`, `price confused`, `not sure about the price` |
| Booking Process Issues | `booking`, `process`, `account`, `app`, `application`, `apply`, `platform`, `listing` | Keep: `how to book`, `confus`. Add: `trouble booking`, `can't figure out`, `hard to navigate`, `stuck on` |
| Host & Approval Concerns | `host`, `response`, `wait`, `owner` | Keep: `reject`, `denied`, `pending approval`. Add: `haven't heard back`, `no response`, `still waiting` |
| Trust & Legitimacy | `safe`, `real` | Keep: `scam`, `legit`, `fraud`, `sketchy`, `too good to be true`. Add: `is this a scam`, `can I trust` |
| Transportation Barriers | `car`, `drive`, `walk`, `ride` | Keep: `too far`, `commute`, `close to work`, `far from`. Add: `no transportation`, `can't get there` |
| Move-In Barriers | `document`, `ready`, `schedule`, `available`, `id`, `timing` | Keep: `background check`, `credit check`, `screening`, `eviction`, `when can i move`. Add: `failed background`, `denied screening` |
| Property & Amenity Mismatch | `room`, `size`, `location`, `space`, `small`, `shared`, `private`, `clean`, `condition` | Keep: `noisy`, `neighborhood`. Add: `too small`, `doesn't have`, `no parking`, `not what I expected`, `wrong room` |
| Financial Constraints | `job`, `money`, `income`, `verification` | Keep: `can't afford`, `too expensive`, `low income`, `fixed income`, `ssi`, `ssdi`, `unemploy`. Add: `not enough money`, `can't pay` |

#### Phase 2: Only Classify from Concerns and Objections (not summary/preferences)

The summary and preferences contain normal descriptive text that will always match generic keywords. Issues should only be detected from fields that explicitly capture **problems**:
- `memberConcerns` -- explicitly flagged concerns
- `objections` -- explicit objections raised

Remove `summary` and `memberPreferences` from the classification input. These fields describe the call and member wants, not problems.

#### Phase 3: Require Minimum Relevance

Add a minimum threshold: only tag an issue if **2 or more** distinct keywords from that category match. A single keyword match is too noisy.

### Files to Modify

1. **`supabase/functions/transcribe-call/index.ts`** (lines 110-134)
   - Update `ISSUE_KEYWORDS_MAP` with tightened keywords
   - Update `classifyIssuesFromKeyPoints` to only use concerns + objections
   - Add 2-keyword minimum threshold

2. **`src/utils/issueClassifier.ts`** (lines 29-103)
   - Mirror the same keyword changes
   - Update `classifyIssues` to only use concerns + objections
   - Add 2-keyword minimum threshold

3. **`supabase/functions/backfill-detected-issues/index.ts`** (lines 10-72)
   - Mirror the same keyword changes
   - Update `classifyFromKeyPoints` to only use concerns + objections
   - Add 2-keyword minimum threshold

4. **Re-run backfill** after deploying changes to re-tag all existing records with the improved classifier

### Expected Outcome

- Most records should have 0-2 issues instead of 5-8
- Only records where the caller explicitly raised concerns about a topic will be tagged
- The pain point filter and icons in Reports will become meaningful and actionable
- Issue distribution should roughly follow a power law (many records with 0 issues, fewer with 1, very few with 3+)

### Implementation Order

1. Update all 3 keyword maps and classifier logic simultaneously
2. Deploy the updated `transcribe-call` and `backfill-detected-issues` functions
3. Reset all `detected_issues` to NULL to force re-processing
4. Run the backfill to re-tag every record
5. Verify the new distribution in the database

