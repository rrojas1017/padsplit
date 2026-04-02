

# STEP 14 — Audience Survey Structured Insights Dashboard

## Current State
- 39 audience survey records exist in `booking_transcriptions.research_extraction` as JSONB
- Current dashboard (`AudienceSurveyDashboard`) renders AI-aggregated data from the `research_insights` table
- The existing extraction JSONB already contains structured fields: `social_media_platforms`, `ad_awareness`, `ad_engagement`, `first_impressions`, `video_testimonial`, etc.

## Key Design Decision
Rather than creating a new `audience_survey_responses` table (duplicating data), we should **query directly from `booking_transcriptions`** where `research_campaign_type = 'audience_survey'` and aggregate client-side. The data is already structured in `research_extraction` JSONB. This avoids:
- A new table + migration
- An edge function to copy data between tables
- Keeping two data sources in sync

The existing 39 records (and future ones) already have all the fields needed. We just need a new hook and dashboard components.

## Implementation Plan (8 files)

### 1. New Hook: `src/hooks/useAudienceSurveyResponses.ts`
- Query `booking_transcriptions` where `research_campaign_type = 'audience_survey'` and `research_extraction IS NOT NULL`
- Join with `bookings` to get `member_name`, `contact_phone`, `booking_date`
- Return raw response array + aggregation helper functions:
  - `aggregateArrayField(field)` — count frequencies across array fields like `social_media_platforms.platforms_used`
  - `aggregateSingleField(field)` — count single-value fields like `ad_awareness.has_seen_padsplit_ads`
  - `crossTab(field1, field2)` — cross-tabulate two fields
- All computation client-side (< 2000 rows expected)

### 2. New Component: `src/components/audience-survey/AudienceSurveyInsightsDashboard.tsx`
- Replace the current `AudienceSurveyDashboard` (which needs AI-generated report data) with a new dashboard that works directly from raw responses
- 7 tabs: Overview | Platforms | Ad Awareness | Messaging | Barriers | Creative | Testimonials
- Each tab maps to a research pillar

### 3. Section Components (new files)

**`src/components/audience-survey/PlatformGapChart.tsx`**
- Grouped bar chart: "Currently Uses" vs "Wants PadSplit Ads Here" per platform
- Uses `social_media_platforms.platforms_used` vs `ad_awareness.expected_padsplit_ad_platforms`
- Auto-generated insight text below

**`src/components/audience-survey/AdExposureDonut.tsx`**
- Donut chart from `ad_awareness.has_seen_padsplit_ads` breakdown
- Center text showing ad recall rate
- Stacked metrics for influencer following + general ad awareness

**`src/components/audience-survey/MessagingMatrix.tsx`**
- Treemap for `ad_engagement.what_makes_them_stop_scrolling` (attention triggers)
- Horizontal bar chart for `ad_engagement.what_makes_them_click_ad` (click motivators)
- Cross-tab heatmap: motivator × platform
- Auto-generated insight text

**`src/components/audience-survey/BarrierAnalysis.tsx`**
- Butterfly/diverging bar chart: `first_impressions.initial_concerns` (left/red) vs `first_impressions.interest_drivers` (right/green)
- Confusion points bar chart from `first_impressions.confusing_aspects`
- Barrier-to-benefit mapping table with auto-generated messaging recommendations

**`src/components/audience-survey/CreativeStrategy.tsx`**
- Pie chart for `ad_engagement.ad_detail_preferences`
- Ranked list/treemap for `ad_engagement.preferred_content_types`
- Platform-specific creative matrix (cross-tab detail pref × platform)
- Auto-generated creative brief card with export

**`src/components/audience-survey/TestimonialPipeline.tsx`**
- KPI cards: total opt-ins, contact info collected, opt-in rate
- Table of candidates from `video_testimonial` data (name, email, phone, date)
- Admin-only (useIsAdmin)
- CSV export button
- Status column (requires a new `testimonial_status` column — see migration below)

### 4. Database Migration
- Add `testimonial_status TEXT DEFAULT 'new'` column to `booking_transcriptions` for tracking testimonial candidate status
- RLS already covers this table

### 5. Update `src/pages/research/ResearchInsights.tsx`
- When `campaignType === 'audience_survey'`, render the new `AudienceSurveyInsightsDashboard` instead of the AI-report-dependent `AudienceSurveyDashboard`
- The new dashboard doesn't need the "Generate Report" flow — it aggregates live from raw data
- Keep the campaign type switcher and date range filter

### 6. Insight Text Generators: `src/utils/audienceSurveyInsights.ts`
- Template-based insight generators for each section (no AI needed)
- `generatePlatformInsight(platformData, adPrefData)`
- `generateAdAwarenessInsight(exposureData, influencerData)`
- `generateMessagingInsight(triggerData, motivatorData, topPlatform)`
- `generateBarrierInsight(concernData, interestData, confusionData)`
- `generateCreativeBrief(allAggregatedData)`

### 7. Overview Tab KPIs
6 KPI cards computed from raw data:
- Total Responses (count of records)
- Completion Rate (from `agent_observations.questions_covered_estimate`)
- Top Platform (most frequent in `social_media_platforms.platforms_used`)
- PadSplit Ad Recall (% where `ad_awareness.has_seen_padsplit_ads = true`)
- #1 Click Motivator (top from `ad_engagement.what_makes_them_click_ad`)
- Testimonial Opt-In Rate (% where `video_testimonial.interested_in_recording = true`)

## What This Preserves
- Move-out survey dashboard: completely untouched
- Existing `AudienceSurveyDashboard`: kept as fallback for AI-generated reports
- All existing audience survey components: preserved, some reused
- Campaign type switcher: preserved
- `booking_transcriptions` schema: only adds one optional column

## Execution Order
1. Migration (testimonial_status column)
2. `useAudienceSurveyResponses` hook
3. `audienceSurveyInsights.ts` utils
4. Section components (6 files, can be parallelized)
5. `AudienceSurveyInsightsDashboard` main component
6. Wire into `ResearchInsights.tsx`

