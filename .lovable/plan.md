
## Feature: Align Communication Insights Frequencies with Reports Issue Classifier

### Problem Analysis

Currently, the `analyze-member-insights` AI function estimates pain point frequencies by analyzing raw call transcription data (memberConcerns, objections). However, these AI estimates include both:
- **Genuine problems/barriers** that should count as pain points
- **Routine informational discussions** (e.g., "when do I pay?" asked during normal booking flow)

In contrast, the Reports page uses a **strict keyword-based classifier** (`src/utils/issueClassifier.ts`) that requires **2+ matching keywords per category** to flag a record. This results in discrepancies:
- AI estimate: 48% of calls mention payment-related topics
- Reports classifier: ~18-20% of calls have actual "Payment & Pricing Confusion" flagged (genuine barriers)

### Root Cause

The AI prompt doesn't distinguish between:
1. **Routine mentions**: "What's the weekly rate?" (informational)
2. **Genuine confusion/barriers**: "I don't understand the move-in costs" (problem)

### Solution Overview

Implement a **hybrid analysis pattern** that:
1. **Maintains AI analysis** for narrative insights and customer journeys
2. **Anchors frequency percentages** to the pre-computed keyword-classifier results
3. **Instructs the AI** to only count calls where the concern was a genuine barrier/obstacle

### Implementation Approach

**Step 1: Pre-compute Hard Counts from Keyword Classifier**
- Before calling the AI, compute how many bookings have each detected issue using the keyword classifier
- Send these as "reference frequencies" to the AI model
- Example:
  ```
  KEYWORD CLASSIFIER RESULTS (Hard Counts):
  - Payment & Pricing Confusion: 18.2% (495 of 2721 calls)
  - Transportation Barriers: 12.4% (337 of 2721 calls)
  - Move-In Barriers: 8.7% (237 of 2721 calls)
  ```

**Step 2: Update AI Prompt**
- Add explicit instructions to use the keyword classifier counts as a baseline
- Instruct the AI: "Your frequency percentages MUST align with these keyword classifier counts. Do NOT estimate higher frequencies based on mentions. Only include calls where this was a genuine barrier that could impact the booking decision."
- Add clarification examples:
  ```
  PAYMENT & PRICING CONFUSION:
  - COUNT AS GENUINE: "I'm confused about the move-in costs, how much is the deposit?"
  - DO NOT COUNT: "What's the weekly rate?" (routine information request)
  
  TRANSPORTATION BARRIERS:
  - COUNT AS GENUINE: "I can't get there by bus, is there parking?"
  - DO NOT COUNT: "Where is the property located?" (general location interest)
  ```

**Step 3: Implementation in Edge Function**
- In `supabase/functions/analyze-member-insights/index.ts`:
  1. Before building the AI prompt, compute detected issue frequencies from the bookings data using `classifyIssues()`
  2. Build a reference object:
     ```typescript
     const issueFrequencies = {
       'Payment & Pricing Confusion': (paymentCount / totalCalls) * 100,
       'Transportation Barriers': (transportCount / totalCalls) * 100,
       // ... etc for all categories
     };
     ```
  3. Pass this to the AI prompt with mandatory instruction: "Use these frequencies as your ground truth. Your analysis should validate and explain these patterns, not override them."

### UI Impact

- **Reports page**: Continues to use keyword classifier (no changes)
- **Communication Insights**: Pain point frequencies now align with Reports classifier
- **Customer Journeys**: Still use AI synthesis but are grounded in factual frequency data
- **Consistency**: A 48% payment concern in Communication Insights now means "48% of calls where payment was a barrier" — matching the Reports filter

### Files to Modify

1. **`supabase/functions/analyze-member-insights/index.ts`** 
   - Import `classifyIssues` from issueClassifier
   - Pre-compute issue frequencies from bookings before calling AI
   - Update AI prompt to include keyword classifier reference frequencies
   - Add explicit instructions about what counts as genuine vs. routine mentions

### Backward Compatibility

- Existing Communication Insights records will still be valid
- Only new analyses running after this change will have aligned frequencies
- No database schema changes needed

### Expected Outcome

- **Before**: "Payment & Fee Confusion - 48%" (includes routine mentions)
- **After**: "Payment & Fee Confusion - 18%" (only genuine barriers/confusion)
- Frequencies now match Reports page classifier results
- AI still provides qualitative insights and customer journey synthesis
- Clear alignment between data-driven classification and AI narrative

