

## Add Priority Badge Glossary

Add a small glossary/legend card at the top of the report content (just below the Executive Summary) explaining what P0, P1, and P2 mean. This will be a compact inline legend using the actual `PriorityBadge` component so it's visually consistent.

### Implementation

**Create `src/components/research-insights/PriorityGlossary.tsx`**

A collapsible or always-visible card with three rows:
- **P0** (red badge) — Critical: Requires immediate action, significant impact on retention or operations
- **P1** (amber badge) — High Priority: Should be addressed soon, measurable impact expected
- **P2** (blue badge) — Medium Priority: Worth monitoring and planning for, lower urgency

Uses the existing `PriorityBadge` component for visual consistency.

**Update `ResearchInsights.tsx`**

Import and render `<PriorityGlossary />` just after the `<ExecutiveSummary>` component, inside the report content section (~line 248). It will only show when a report is loaded.

