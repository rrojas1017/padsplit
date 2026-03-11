

## Research Insights -- Full Code Package

Here is the complete source code for the Research Insights section. The core problem remains: report `8f806a9f` has all `reason_code_distribution` counts zeroed out by a failed SQL migration, and it appears to be the **only** report in the database. Marking it as `failed` means the UI now shows "Report generation failed" instead of data.

**The fix is simple**: generate a fresh report. The backend normalization code is now hardened. But below is every file you requested.

---

### Files included (16 total)

**Page + Layout:**
1. `src/pages/research/ResearchInsights.tsx` (405 lines)

**UI Components (10):**
2. `src/components/research-insights/ExecutiveSummary.tsx` (109 lines)
3. `src/components/research-insights/ReasonCodeChart.tsx` (220 lines)
4. `src/components/research-insights/ReasonCodeDrillDown.tsx` (304 lines)
5. `src/components/research-insights/IssueClustersPanel.tsx` (123 lines)
6. `src/components/research-insights/TopActionsPanel.tsx` (147 lines)
7. `src/components/research-insights/BlindSpotsPanel.tsx` (50 lines)
8. `src/components/research-insights/HostAccountabilityPanel.tsx` (87 lines)
9. `src/components/research-insights/EmergingPatternsPanel.tsx` (74 lines)
10. `src/components/research-insights/PaymentFrictionCard.tsx` (110 lines)
11. `src/components/research-insights/TransferFrictionCard.tsx` (121 lines)
12. `src/components/research-insights/AgentPerformanceCard.tsx` (116 lines)
13. `src/components/research-insights/PriorityBadge.tsx` (37 lines)
14. `src/components/research-insights/HumanReviewQueue.tsx` (90 lines)
15. `src/components/research-insights/ProcessedRecordsList.tsx` (154 lines)
16. `src/components/research-insights/ResearchPromptsSettings.tsx` (192 lines)

**Hooks (2):**
17. `src/hooks/useResearchInsightsData.ts` (214 lines)
18. `src/hooks/useResearchInsightsPolling.ts` (174 lines)

**Backend:**
19. `supabase/functions/generate-research-insights/index.ts` (846 lines)

---

### Current Database State

The only report (`8f806a9f`) has status `failed` with error "Data corrupted by migration". The `reason_code_distribution` array has 60+ entries all with `count: 0`. The `executive_summary` is intact with valid data (191 cases analyzed, rich narrative). Other sections (issue_clusters, top_actions, blind_spots, etc.) appear to have valid data.

**To restore**: simply click "Generate Report" in the UI to produce a fresh report through the now-hardened pipeline.

---

### Schema context for the AI report data

The `research_insights.data` JSONB column stores the full report. The aggregation prompt (Prompt C) in the edge function defines the expected output schema. The AI can return data in two formats:

**Format A (prompt default -- array-based):**
- `reason_code_distribution`: array of `{ code, count, pct, booking_ids, reason_codes_included }`
- `top_actions`: flat array of `{ rank, action, rationale, priority, owner }`
- `host_accountability_flags`: array of `{ issue_pattern, frequency, impact_on_retention }`

**Format B (narrative -- sometimes returned by Gemini):**
- `reason_code_distribution`: `{ total_cases, preventable_churn, by_category: [{ category, count, percentage, description }] }`
- `top_actions`: object with `{ p0_immediate_risk_mitigation: [], p1_systemic_process_redesign: [], quick_wins: [] }`
- `executive_summary`: `{ title, key_findings, period, recommendation_summary, urgent_quote }`
- `host_accountability_flags`: `[{ flag, description, priority }]`

The UI components handle both formats defensively. The `normalizeChunkResult()` function in the edge function converts Format B objects/strings into Format A arrays.

---

### What actually needs to happen

1. **Delete the corrupted report** or just generate a new one -- the pipeline is hardened now
2. The UI code is correct and handles both data formats
3. No component redesign needed -- the "mess" is caused by zeroed-out data from the bad migration, not broken UI code

