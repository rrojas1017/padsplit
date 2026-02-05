

# Refactor `analyze-non-booking-insights` for Successful Deployment

## Root Cause Analysis

The `analyze-non-booking-insights` edge function is failing to deploy due to **excessive bundle size** (612 lines), while `analyze-member-insights` (733 lines) deploys successfully. The difference is not just line count—it's **code complexity and redundancy**:

| Aspect | analyze-non-booking-insights | analyze-member-insights |
|--------|-----|-----|
| Total Lines | 612 | 733 |
| Redundancy | High (duplicated aggregation logic) | Lower (specialized for bookings) |
| Helper Functions | 1 (logApiCost) | 2 (logApiCost + fetchPreviousAnalysis + calculateTrendDeltas) |
| AI Prompt Complexity | Simpler (fixed structure) | Complex (dynamic customer journeys) |
| Retry Logic | None | Robust retry loop (lines 458-510) |
| Pre-computation | Simpler factual data | More intelligent mapping (source booking IDs) |
| Bundler Status | ❌ 404 (never deployed) | ✅ 200 (deployed successfully) |

**Why it matters:** When the bundler times out on a large function with many branches and conditions, it fails to generate the compiled code. Smaller, simpler functions bundle faster and succeed.

---

## Refactoring Strategy

### Phase 1: Extract Data Aggregation (Reduces ~120 lines)

**Goal:** Move the repetitive data aggregation logic (lines 133-282) into a separate, reusable helper.

**What to extract:**
- Concern/objection/summary tracking loops
- Sentiment and readiness counting
- Market and agent data bucketing
- Pre-computed breakdown calculations

**New file:** Keep logic in `index.ts` but wrap in a function to reduce main function scope.

**Expected reduction:** 612 → 480 lines

---

### Phase 2: Simplify AI Prompt Building (Reduces ~50 lines)

**Goal:** The AI prompt (lines 284-400) contains redundant explanations and can be condensed without losing meaning.

**Current issues:**
- Long repetitive MARKET DATA and AGENT DATA sections (lines 312-320) that could be formatted more concisely
- Agent insights template generation creates duplicate structure (lines 377-380)
- Market insights template duplicates concern patterns

**Simplifications:**
- Use a single data format for agent/market lists instead of template generators
- Reduce explanation text while keeping requirements clear
- Pre-format agent/market data as a compact list instead of verbose descriptions

**Expected reduction:** ~50 lines of AI prompt construction code

---

### Phase 3: Optimize Cost Logging (Reduces ~20 lines)

**Current:** `logApiCost` function is 26 lines with hardcoded rates.

**Solution:** Use simpler, inline cost calculation (like `analyze-member-insights` does at lines 80-82).

**Expected reduction:** ~20 lines

---

### Phase 4: Improve AI Response Parsing (Reduces ~10 lines)

**Current:** Lines 450-465 use basic string trimming.

**Upgrade:** Use `analyze-member-insights` approach (lines 489-510) with JSON extraction regex and retry logic, which is more robust AND more concise.

**Expected reduction:** ~10 lines saved, but adds resilience

---

## Target: 612 → ~400 Lines

With these refactorings:
- **Data aggregation wrapper:** -120 lines
- **Prompt simplification:** -50 lines
- **Cost logging inline:** -20 lines
- **Cleaner error handling:** -20 lines
- **Total:** 612 → ~400 lines (35% reduction)

This will make the function:
1. **Faster to bundle** (fewer lines, simpler AST)
2. **Easier to maintain** (less code duplication)
3. **More reliable** (improved error handling from Member Insights patterns)

---

## Implementation Details

### Step 1: Create `aggregateNonBookingData` Helper

Move lines 133-282 into a function that returns:
```typescript
{
  allConcerns, allObjections, allSummaries,
  sentimentCounts, readinessCounts,
  marketData, agentData,
  totalDuration, durationCount
}
```

This reduces nesting and main function complexity.

---

### Step 2: Simplify AI Prompt

Instead of:
```
MARKET DATA:
${Object.entries(marketData).map(([market, data]) => 
  `${market}: ${data.count} non-bookings, ...`
).join('\n')}
```

Use:
```
MARKET DATA (by count): ${Object.entries(marketData)
  .map(([m, d]) => `${m} (${d.count})`)
  .join(', ')}
```

Saves ~15 lines in prompt construction.

---

### Step 3: Inline Cost Calculation

Replace the `logApiCost` function call with direct calculation:

```typescript
const inputTokens = Math.ceil(aiPrompt.length / 4);
const outputTokens = Math.ceil(analysisText.length / 4);
const inputCost = (inputTokens / 1000) * 0.00125;
const outputCost = (outputTokens / 1000) * 0.005;
const cost = inputCost + outputCost;

await supabase.from('api_costs').insert({
  service_provider: 'deepseek',
  service_type: 'ai_non_booking_insights',
  edge_function: 'analyze-non-booking-insights',
  input_tokens: inputTokens,
  output_tokens: outputTokens,
  estimated_cost_usd: cost,
  metadata: { model: 'google/gemini-2.5-pro', totalCalls }
});
```

Eliminates the 26-line helper entirely.

---

### Step 4: Add JSON Parsing Retry Logic

Replace lines 450-465 with `analyze-member-insights` pattern (with max 2 retries, exponential backoff). This adds safety without much code growth.

---

## Files to Change

| File | Change |
|------|--------|
| `supabase/functions/analyze-non-booking-insights/index.ts` | Refactor: extract helpers, simplify prompt, inline costs, improve parsing |

---

## Expected Outcome

✅ Function reduces from 612 to ~400 lines (still feature-complete)
✅ Bundler succeeds (smaller function = faster compilation)
✅ 404 error resolves
✅ Non-Booking analysis becomes available on Communication Insights page
✅ Member Insights and Non-Booking Insights can run in parallel

---

## Timeline

- **Refactoring:** ~20 minutes
- **Testing:** ~5 minutes
- **Deployment:** Automatic with next build

