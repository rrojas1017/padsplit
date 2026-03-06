

## Redesign Research Insights from Scratch

### Problem
The UI components still don't render the actual report data because field names are mismatched. The data itself is excellent — rich, actionable, well-organized with P0/P1/P2 priorities, member quotes, and specific recommendations. The UI just needs to be rebuilt to match what the AI actually produces.

### Actual Data Structure (from the completed report)

```text
executive_summary:
  ├── title (string)
  ├── key_findings (string - paragraph)
  ├── period (string)
  ├── recommendation_summary (string)
  └── urgent_quote (string)

reason_code_distribution:
  ├── total_cases (number)
  ├── preventable_churn (number)
  ├── unpreventable_churn (number)
  └── by_category[]:
      ├── category (string)
      ├── count (number)
      ├── percentage (number)
      └── description (string)

issue_clusters[]:
  ├── cluster_name (string)
  ├── description (string)
  ├── priority (string: "P0", "P1")
  ├── recommended_action (string)
  └── supporting_quotes[] (strings)

top_actions: (OBJECT, not array)
  ├── p0_immediate_risk_mitigation[]:
  │   ├── action (string)
  │   ├── description (string)
  │   └── ownership (string)
  ├── p1_systemic_process_redesign[]:
  │   └── (same shape)
  └── quick_wins[]:
      └── (same shape)

operational_blind_spots[]:
  ├── blind_spot (string)
  └── description (string)

host_accountability_flags[]:
  ├── flag (string)
  ├── description (string)
  └── priority (string)

emerging_patterns[]:
  ├── pattern (string)
  ├── description (string)
  └── quote (string)

payment_friction_analysis:
  ├── summary (string)
  └── key_friction_points[]:
      ├── point (string)
      ├── description (string)
      ├── quote (string)
      └── impact (string: "Critical", "High")

transfer_friction_analysis:
  └── (same shape as payment)

agent_performance_summary:
  ├── strengths (string)
  └── opportunities_for_improvement[]:
      ├── area (string)
      ├── description (string)
      └── recommendation (string)
```

### Plan (10 files to update)

#### 1. ExecutiveSummary.tsx — Rewrite
Map to actual fields: `title`, `key_findings` (plural), `period`, `recommendation_summary`, `urgent_quote`. Show the title prominently, key findings as narrative paragraph, urgent quote in a highlighted callout, and recommendation summary in an action card.

#### 2. ReasonCodeChart.tsx — Rewrite  
Read `by_category[]` with fields `category`, `count`, `percentage`, `description`. Add stat cards at top for `total_cases`, `preventable_churn`, `unpreventable_churn`. Keep the horizontal bar chart but use the correct fields.

#### 3. IssueClustersPanel.tsx — Rewrite
Map `description` (not `cluster_description`), `priority` (string like "P0"), `recommended_action` (string, not object), `supporting_quotes[]` (not `representative_quotes`). Show priority badge prominently. Remove severity_distribution, root_cause references.

#### 4. TopActionsPanel.tsx — Rewrite completely
Data is an **object** with three keyed arrays (`p0_immediate_risk_mitigation`, `p1_systemic_process_redesign`, `quick_wins`), not a flat array. Render as three grouped sections with P0/P1/Quick Win headers. Each item has `action`, `description`, `ownership`.

#### 5. BlindSpotsPanel.tsx — Minor fix
Already mostly correct (`blind_spot`, `description`). Remove unused `priority`, `how_discovered`, `estimated_prevalence`, `recommended_detection_method` references.

#### 6. HostAccountabilityPanel.tsx — Fix priority mapping
Data has `flag`, `description`, `priority` (string like "P0", "P1"). Add PriorityBadge based on the `priority` field instead of parsing the title text.

#### 7. EmergingPatternsPanel.tsx — Already correct
Has `pattern`, `description`, `quote`. No `watch_or_act` in actual data — gracefully handles missing. Minimal changes.

#### 8. PaymentFrictionCard.tsx — Rewrite
Data has `summary` + `key_friction_points[]` (objects with `point`, `description`, `quote`, `impact`), not `key_failures[]` (strings). Render each friction point as a card with impact badge and member quote.

#### 9. TransferFrictionCard.tsx — Rewrite (same pattern)
Same structure as payment friction. Render `key_friction_points[]` with `point`, `description`, `quote`, `impact`.

#### 10. AgentPerformanceCard.tsx — Rewrite
Data has `strengths` (string) + `opportunities_for_improvement[]` (objects with `area`, `description`, `recommendation`), not `weaknesses[]` (strings). Render each opportunity as its own card with area title, description, and recommendation.

#### 11. ResearchInsights.tsx page — Reorganize layout
- Executive Summary full-width at top
- Reason Code Distribution full-width with preventable/unpreventable stat cards
- Issue Clusters full-width (collapsible, P0 first)
- Top Actions full-width (grouped by priority tier)
- Two-column layout: Payment Friction | Transfer Friction
- Two-column layout: Blind Spots | Host Accountability
- Agent Performance full-width
- Emerging Patterns full-width
- Human Review Queue and Processed Records at bottom

### Note on Claude
Claude (Anthropic) is not available through the supported AI models. The current Gemini 2.5 Pro model produced excellent, rich data — the problem was purely the UI not matching the output schema. No model change is needed.

