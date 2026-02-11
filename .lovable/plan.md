

# Cross-Sell and Upsell Opportunity Intelligence (Super Admin Only)

## Overview
Extract lifestyle signals from every call transcription to identify cross-sell/upsell opportunities (healthcare/ACA, pet care, transportation, home services, telephony, employment, financial, moving). Display aggregated trends in a new tab on the Communication Insights page, restricted to super_admin only.

## Signal Categories

| Category | Examples | Opportunity |
|----------|----------|-------------|
| Healthcare/ACA | "no insurance", "need coverage", uninsured | ACA enrollment partnerships |
| Pet Ownership | "I have a dog", "pet-friendly", pet deposit | Pet care, pet insurance |
| Transportation | Car details, "no car", rideshare mentions | Auto insurance, rideshare deals |
| Home Services | Furniture, cleaning, WiFi, laundry needs | Furniture rental, cleaning services |
| Telephony/Tech | Phone plan issues, no service, WiFi needs | Phone plan partnerships |
| Employment | Job searching, work schedule, "not working" | Staffing/job placement |
| Financial | Payment issues, no bank account, credit | Fintech, banking partnerships |
| Moving/Logistics | Moving help, storage, shipping | Moving service partnerships |

## Implementation

### 1. Update AI Prompts to Extract Lifestyle Signals
Add a `lifestyleSignals` array to the JSON output schema in all 4 prompt-building functions across 2 edge functions:

**Files:**
- `supabase/functions/transcribe-call/index.ts` -- `buildDynamicPrompt()` and `buildDefaultPrompt()`
- `supabase/functions/reanalyze-call/index.ts` -- `buildDynamicAnalysisPrompt()` and `buildDefaultAnalysisPrompt()`

**Addition to JSON schema (after agentFeedback):**
```json
"lifestyleSignals": [
  {
    "category": "healthcare | pet | transportation | home_services | telephony | employment | financial | moving",
    "signal": "Exact quote or paraphrase from the conversation",
    "confidence": "high | medium | low",
    "opportunity": "Brief cross-sell opportunity description"
  }
]
```

**Also update keyPoints assembly** (lines ~1682 and ~674 respectively) to include `lifestyleSignals` from parsed output.

### 2. Update TypeScript Types
In `src/types/index.ts`, add:
```typescript
export interface LifestyleSignal {
  category: 'healthcare' | 'pet' | 'transportation' | 'home_services' | 'telephony' | 'employment' | 'financial' | 'moving';
  signal: string;
  confidence: 'high' | 'medium' | 'low';
  opportunity: string;
}
```
And add `lifestyleSignals?: LifestyleSignal[]` to the `CallKeyPoints` interface.

### 3. Create Aggregation Edge Function
New `supabase/functions/aggregate-lifestyle-signals/index.ts`:
- Query `booking_transcriptions` for `call_key_points->'lifestyleSignals'`
- Accept date range filters
- Group by category, count frequency, extract top signals and example quotes
- Return market-level breakdowns (which cities have highest signal density)
- Restricted via auth check to super_admin role

### 4. Create Cross-Sell Opportunities UI
New `src/components/call-insights/CrossSellOpportunitiesTab.tsx`:
- **Opportunity Summary Cards**: Each signal category as a card with total mentions count, trend indicator, and top example quote
- **Market Breakdown Table**: Which markets have the highest concentration per category
- **Timeline Chart**: Signal frequency over time (using recharts, already installed)
- **Signal Details Table**: Expandable rows showing individual signals with confidence, opportunity, and source booking

### 5. Add Tab to Communication Insights Page
In `src/pages/CallInsights.tsx`:
- Add a third tab: "Cross-Sell Opportunities" with a shopping bag or handshake icon
- Only render this tab for super_admin users (use `useAuth()` to check role)
- Update TabsList grid from `grid-cols-2` to `grid-cols-3` when super_admin

### 6. Update Route Access Control
In `src/App.tsx`, the `/call-insights` route already allows `super_admin` and `admin`. The cross-sell tab will be conditionally rendered only for `super_admin` within the page component itself -- no route change needed.

### 7. Add Sidebar Navigation Update
No sidebar change needed -- Cross-Sell is a tab within the existing "Communication Insights" page.

### 8. Backfill Strategy
Create `supabase/functions/batch-extract-lifestyle-signals/index.ts`:
- Re-processes existing transcriptions that have `call_key_points` but no `lifestyleSignals`
- Uses Flash model for cost efficiency
- Processes in batches of 10 with rate limiting
- Can be triggered from the UI (super_admin only button on the Cross-Sell tab)

## Cost Impact
- **Zero additional cost per new call**: Signals extracted in the same AI analysis pass (just extra fields in prompt output)
- **Backfill**: One-time cost using Flash-lite model, estimated ~$0.001 per record
- **Aggregation**: Minimal DB reads only

## Files Changed
1. `supabase/functions/transcribe-call/index.ts` -- Add lifestyleSignals to 2 prompt functions + keyPoints assembly
2. `supabase/functions/reanalyze-call/index.ts` -- Add lifestyleSignals to 2 prompt functions + keyPoints assembly
3. `src/types/index.ts` -- Add LifestyleSignal interface, update CallKeyPoints
4. `supabase/functions/aggregate-lifestyle-signals/index.ts` -- New aggregation function
5. `supabase/functions/batch-extract-lifestyle-signals/index.ts` -- New backfill function
6. `src/components/call-insights/CrossSellOpportunitiesTab.tsx` -- New UI component
7. `src/pages/CallInsights.tsx` -- Add third tab (super_admin only)

## Access Control
- Cross-Sell tab: visible only to `super_admin` (checked via `useAuth()` in CallInsights page)
- Aggregation edge function: validates caller is super_admin
- Backfill function: validates caller is super_admin
- `admin` users see the existing two tabs but NOT the Cross-Sell tab

