

## Modernize Research Insights UI

Visual-only refresh across all research insight components. No content, data, or layout position changes. Same components, same sections, same order — just polished to look more professional and aligned with the existing PadSplit design system (navy primary, gold accent, gradient cards, subtle shadows).

### Changes by file

**1. `src/pages/research/ResearchInsights.tsx`**
- Controls bar: wrap in a frosted-glass style card (`bg-card/80 backdrop-blur border`) instead of bare flex
- Processing status banner: add subtle gradient background, softer border radius
- In-progress banner: use a gradient shimmer border effect instead of flat `bg-primary/5`
- Empty state: add a subtle gradient background and refine spacing
- Section dividers: add `space-y-8` instead of `space-y-6` for more breathing room

**2. `src/components/research-insights/ExecutiveSummary.tsx`**
- Use `var(--gradient-hero)` background with white text for the title area (hero-banner style)
- Add subtle shadow (`shadow-md`) to the card
- Refine the recommendation and impact boxes with slightly stronger rounded corners and padding
- Quote block: add a subtle gold left-border instead of amber

**3. `src/components/research-insights/ReasonCodeChart.tsx`**
- Card: add `shadow-sm` and `overflow-hidden`
- Summary stat cards: add subtle gradient backgrounds instead of flat `bg-muted/50`
- Detail list items: add left color stripe (4px) matching the bar color instead of the small square dot
- Smoother hover transition on detail cards

**4. `src/components/research-insights/IssueClustersPanel.tsx`**
- Collapsible trigger: add left-accent border (4px) colored by priority (red=P0, amber=P1, blue=P2)
- Expanded content: softer background tint
- Quote blockquotes: use gold accent border

**5. `src/components/research-insights/TopActionsPanel.tsx`**
- Action cards: add subtle left border colored by priority tier
- Numbered circles: use gradient fill instead of flat `bg-primary/10`
- Section headers: add a thin bottom divider line

**6. `src/components/research-insights/PaymentFrictionCard.tsx` & `TransferFrictionCard.tsx`**
- Card header: add colored icon background circle (like a pill) behind the icon
- Friction point items: left-accent border by impact level
- Recommendation box: use gold accent gradient border

**7. `src/components/research-insights/BlindSpotsPanel.tsx`**
- Items: add amber left-accent border (4px), subtle amber tint on hover
- Add numbered indicators

**8. `src/components/research-insights/HostAccountabilityPanel.tsx`**
- Items: add left-accent border colored by priority
- Recommendation sub-boxes: use slightly darker tint

**9. `src/components/research-insights/AgentPerformanceCard.tsx`**
- Strengths box: use gradient green tint instead of flat
- Opportunity items: add left amber border accent
- Card: add shadow-sm

**10. `src/components/research-insights/EmergingPatternsPanel.tsx`**
- Items: add colored left border based on `watch_or_act` status
- Badge styling: slightly bolder with icon indicators

**11. `src/components/research-insights/HumanReviewQueue.tsx`**
- Items: add amber left-accent border
- Card header: add amber tint background

**12. `src/components/research-insights/PriorityBadge.tsx`**
- Add subtle dot indicator before text for each priority level

### Design principles applied
- Consistent left-accent borders (4px) on list items for visual hierarchy
- Subtle card shadows (`shadow-sm`) throughout
- Gradient tints replacing flat color backgrounds
- More generous spacing between sections
- Icon backgrounds (small pill circles) for card headers
- All using existing CSS custom properties — no new design tokens needed

