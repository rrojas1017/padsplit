

## Problem

The Research Insights report has rich, actionable data (105 cases analyzed with detailed findings), but **the UI shows mostly empty/broken content** because the AI-generated JSON structure doesn't match the field names the React components expect.

**Data mismatch examples:**

| Component expects | Actual data field |
|---|---|
| `executive_summary.headline` | `executive_summary.title` + `key_finding` |
| `executive_summary.total_cases` | missing (needs to derive from context) |
| `executive_summary.addressable_pct` | mentioned in `quantified_impact` text |
| `issue_clusters[].frequency` | `case_count` |
| `issue_clusters[].representative_quotes` | `key_quotes` |
| `issue_clusters[].systemic_root_cause` | `root_cause` |
| `issue_clusters[].severity_distribution` | missing |
| `top_actions[].rank` | missing |
| `top_actions[].rationale` | `description` |
| `top_actions[].cases_affected` | missing |
| `blind_spots[].how_discovered` | `description` |
| `reason_code_distribution[].code` | nested under `.distribution[].reason_group` |
| `host_accountability_flags[].issue_pattern` | `flag` |
| `host_accountability_flags[].frequency` | missing |
| `emerging_patterns[].frequency` | missing |
| `payment_friction_analysis.payment_related_moveouts` | `summary` + `key_failures` (text) |

## Plan

### 1. Redesign all Research Insights UI components to match actual data

Update every component to render the data structure the AI actually produces. This means rewriting the interfaces and rendering logic for:

- **ExecutiveSummary** — Show `title`, `key_finding` (as the main narrative), `quantified_impact`, `urgent_recommendation`, and `period`. Display as a prominent narrative card rather than stat tiles (since the AI provides prose, not numbers).

- **ReasonCodeChart** — The data is under `reason_code_distribution.distribution[]` with fields `reason_group`, `count`, `percentage`, `details`. Update the chart to use these fields.

- **IssueClustersPanel** — Map `case_count` → frequency, `key_quotes` → quotes, `root_cause` → root cause, `recommended_action.action/priority` → action card. Remove `severity_distribution` dependency.

- **TopActionsPanel** — Use `action`, `description`, `owner`, `priority`. Auto-generate rank from array index. Remove dependency on `cases_affected`, `pct_of_batch`, `effort`, `quick_win`.

- **BlindSpotsPanel** — Use `blind_spot`, `description`, `priority`. Remove `how_discovered`, `estimated_prevalence`, `recommended_detection_method`.

- **HostAccountabilityPanel** — Use `flag` (as title), `description`, `quote`, `recommendation`. Remove `frequency`, `impact_on_retention`, `impact_on_legal_risk` dependencies.

- **EmergingPatternsPanel** — Use `pattern`, `description`, `quote`. Remove `frequency`, `watch_or_act` dependencies.

- **PaymentFrictionCard** — Render `summary`, `key_failures[]`, `recommendation` as narrative content instead of stat tiles.

- **TransferFrictionCard** — Same approach: render narrative fields.

### 2. Improve the page layout inspired by the reference image

Reorganize the Research Insights page to present content in a more scannable, actionable format:

- Executive Summary as a prominent header card with the key finding narrative
- Issue Clusters with inline tags, root cause, and action in a single expandable card (similar to reference)
- Blind Spots and Top Actions side-by-side in a two-column layout (matching reference)
- Priority badges (P0/P1/P2) and severity badges (Critical/High) prominently displayed

### 3. Make the aggregation prompt more consistent (optional stabilization)

No prompt changes needed now — the UI should be flexible enough to handle the AI's output. But we'll add fallback field mapping in each component so both the "template" schema and the "actual" schema work.

