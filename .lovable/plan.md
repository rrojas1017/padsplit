
# Fix "Common Blockers" Section - Server-Side Objection Grouping

## Problem Analysis
The "Common Blockers" panel shows many items each at 1% frequency because:
1. **Unique Verbatim Strings**: Each objection extracted by AI is a complete sentence (e.g., "Cannot book today due to temporary financial shortfall ('only got paid a two-day check')") - resulting in 194 unique strings from 194 calls with zero overlap
2. **No Pre-Aggregation**: Raw strings are sent directly to AI without grouping
3. **Missing Count Data**: The AI prompt provides 40 sample objections but no frequency counts, so it guesses 1% for each
4. **Database Evidence**: SQL analysis shows when objections are grouped by keywords, clear patterns emerge:
   - Timing/Not Ready: 33%
   - Financial/Payment Issues: 16%
   - Exploring Options: 10%
   - etc.

## Solution: Server-Side Semantic Pre-Aggregation

Modify `supabase/functions/analyze-non-booking-insights/index.ts` to group objections into semantic categories before AI analysis:

### Phase 1: Define Category Keywords
Create a keyword-based categorization function that maps objection text to themes:
- **Timing/Readiness**: "now", "today", "ready", "wait", "later", "timing", "not yet"
- **Financial/Payment**: "fund", "money", "pay", "afford", "card", "price", "check", "budget"
- **Exploring Options**: "found", "looking", "search", "option", "different", "compare"
- **Property Viewing**: "view", "see", "visit", "tour", "property"
- **Availability Issues**: "call", "talk", "speak", "busy", "contact"
- **Privacy/Shared Living**: "share", "roommate", "private", "alone"
- **Application/Approval**: "denied", "application", "approved", "verify"
- **Location/Distance**: "far", "location", "commute", "distance", "near"
- **Move-in Timeline**: "move-in", "date", "month", "week", "deadline"

### Phase 2: Pre-Aggregate Before AI Call
Instead of sending raw objections, aggregate into structured categories:

```text
OBJECTION CATEGORIES (pre-aggregated from 240 calls):
1. Timing/Not Ready Yet: 82 occurrences (34%)
   - Examples: "Not ready to commit immediately", "Cannot do it today"
2. Financial Constraints: 45 occurrences (19%)
   - Examples: "Insufficient funds", "Waiting for paycheck"
3. Still Exploring Options: 28 occurrences (12%)
   - Examples: "Looking at other places", "Found something else"
...
```

### Phase 3: AI Refinement
Ask AI to:
- Validate/refine category names for clarity
- Generate actionable suggestions per category
- Identify any miscategorized items in "Other"
- Prioritize by impact (high/medium/low)

### Output Structure Change
Instead of 40+ items at 1%:

```text
+------------------------------------------+
| Common Blockers                          |
+------------------------------------------+
| Timing/Readiness Issues            [34%] |
| Not ready to commit, waiting for...      |
| Suggestion: Implement callback system... |
+------------------------------------------+
| Financial Constraints              [19%] |
| Insufficient funds, waiting for...       |
| Suggestion: Offer flexible payment...    |
+------------------------------------------+
| Still Exploring Options            [12%] |
```

## Technical Implementation

### Files to Modify:
1. `supabase/functions/analyze-non-booking-insights/index.ts`
   - Add `categorizeObjection()` helper function with keyword matching
   - Aggregate objections into categories with counts before AI call
   - Update AI prompt to expect pre-grouped data
   - Have AI refine labels and add suggestions only

2. `src/components/call-insights/NonBookingRecommendationsPanel.tsx`
   - Update UI to better display grouped categories
   - Add progress bars to visualize frequency percentages
   - Improve suggestion formatting

### Key Code Changes:

**Edge Function - Categorization Logic:**
```typescript
const OBJECTION_CATEGORIES = {
  'Timing/Readiness': ['today', 'now', 'ready', 'wait', 'later', 'timing', 'not yet', 'right now'],
  'Financial Constraints': ['fund', 'money', 'pay', 'afford', 'card', 'price', 'check', 'budget', 'cost'],
  'Exploring Options': ['found', 'looking', 'search', 'option', 'different', 'compare', 'other place'],
  // ... more categories
};

function categorizeObjection(text: string): string {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(OBJECTION_CATEGORIES)) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }
  return 'Other';
}

// Aggregate before AI
const grouped: Record<string, { count: number; examples: string[] }> = {};
for (const obj of objections) {
  const cat = categorizeObjection(obj);
  if (!grouped[cat]) grouped[cat] = { count: 0, examples: [] };
  grouped[cat].count++;
  if (grouped[cat].examples.length < 3) grouped[cat].examples.push(obj);
}
```

**Updated AI Prompt:**
```typescript
const prompt = `Analyze ${total} Non-Booking calls with pre-grouped objections.

OBJECTION BREAKDOWN (server-aggregated):
${Object.entries(grouped)
  .sort((a, b) => b[1].count - a[1].count)
  .map(([cat, data]) => 
    `${cat}: ${data.count} calls (${Math.round(data.count/total*100)}%)\n  Examples: ${data.examples.join('; ')}`
  ).join('\n')}

Return JSON with refined objection patterns. For each category:
- Keep the category name or suggest a better label
- Calculate accurate percentage from the count data
- Provide a specific, actionable suggested_response

{
  "objection_patterns": [
    {"objection": "Category Name", "frequency": 34, "suggested_response": "actionable response..."}
  ]
}`;
```

## Expected Result
After implementation, the "Common Blockers" panel will show:
- 6-10 meaningful categories instead of 40+ individual items
- Accurate percentages (34%, 19%, 12%...) instead of all showing 1%
- Actionable suggestions per category
- Clear hierarchy from most to least common

## Benefits
1. **Accuracy**: Percentages reflect actual data distribution
2. **Actionability**: Grouped patterns are easier to address strategically
3. **Performance**: Smaller AI prompt = faster response + lower cost
4. **Consistency**: Same categorization logic across analyses
