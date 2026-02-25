

## The Problem

The Dashboard Cost Breakdown correctly shows low per-record API costs ($0.0098 today). The user's $20/day spend is on **Lovable Cloud platform charges** (compute, hosting, AI models), which are completely separate and NOT displayed anywhere in the app.

## What Needs to Happen

There is no code fix needed here - the dashboard is showing accurate data. However, to reduce the Lovable Cloud spend ($446 Cloud + $153 AI per month), we should optimize edge function usage since that's what drives Cloud compute costs.

### Key Cost Drivers (Lovable Cloud)
- **60+ deployed edge functions** - each deployment and invocation costs compute
- **Realtime subscriptions** - continuous database connections
- **AI model calls** (Gemini/DeepSeek) via edge functions like `analyze-member-insights`, `generate-qa-scores`, `compare-llm-providers`

### Optimization Options

1. **Consolidate edge functions** - Merge similar functions to reduce deployment overhead (e.g., batch processors)
2. **Add response caching** - Cache AI analysis results to avoid redundant LLM calls for the same data
3. **Reduce polling intervals** - The realtime cost monitor polls every 30 seconds; increase to 60s or rely solely on realtime subscriptions
4. **Add Lovable Cloud cost visibility** - Add a note or widget on the Billing page explaining that Lovable platform costs are separate from API costs, with a link to workspace settings

### Recommended First Step
Add a "Platform Costs" info banner on the Billing page that clarifies the distinction between tracked API costs and Lovable Cloud infrastructure costs, so the user doesn't confuse them again.

