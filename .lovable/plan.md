

# Add "Script Responses" Tab + Executive Report Download for Audience Survey

## Data Reality

The audience survey data lives in `booking_transcriptions.research_extraction` as nested JSONB — NOT as q1-q16 columns. The extraction has 13 identifiable questions mapped to nested fields (see `countAnsweredQuestions()` in the dashboard). The question map must use extraction field accessors, not column names.

## Question Map (Extraction Fields → Labels)

| # | Label | Type | Accessor |
|---|-------|------|----------|
| Q1 | Which social media platforms do you use? | multi | `social_media_platforms.platforms_used` |
| Q2 | Do you follow any influencers? | yesno | `influencer_following.follows_influencers` |
| Q3 | Have you noticed any standout housing ads? | yesno | `ad_awareness.noticed_standout_ads` |
| Q4 | Have you seen PadSplit ads? | yesno | `ad_awareness.has_seen_padsplit_ads` |
| Q5 | Where would you expect to see PadSplit ads? | multi | `ad_awareness.expected_padsplit_ad_platforms` |
| Q6 | What makes you stop scrolling on an ad? | multi | `ad_engagement.what_makes_them_stop_scrolling` |
| Q7 | What would make you click on an ad? | multi | `ad_engagement.what_makes_them_click_ad` |
| Q8 | What were your initial concerns about PadSplit? | multi | `first_impressions.initial_concerns` |
| Q9 | What initially interested you about PadSplit? | multi | `first_impressions.interest_drivers` |
| Q10 | What was confusing about PadSplit? | multi | `first_impressions.confusing_aspects` |
| Q11 | Do you prefer detailed or short ads? | multi | `ad_engagement.ad_detail_preferences` |
| Q12 | What content would you want to see? | multi | `ad_engagement.preferred_content_types` |
| Q13 | Would you record a video testimonial? | yesno | `video_testimonial.interested_in_recording` |

## New Files

### 1. `src/components/audience-survey/ScriptResponsesTab.tsx`
- Renders all 13 question cards in a scrollable list
- Progress summary banner at top (completion rate, response count, avg questions answered)
- "Jump to question" dropdown for quick navigation
- "Download Report" button in header
- Uses existing `useAudienceSurveyResponses` hook — receives `records` as prop
- For each question, calls appropriate aggregation (aggregateArray for multi, aggregateBoolean for yesno) then renders a `QuestionResponseCard`

### 2. `src/components/audience-survey/QuestionResponseCard.tsx`
- Props: question number, label, type, aggregated data, total records
- **multi type**: Horizontal bar chart — bars sorted by count desc, bar fill proportional to max count, shows count + pct per row. Uses `normalizeLabel()` + `formatAggLabels()` before rendering. Stats footer: unique answers count, most common answer.
- **yesno type**: Two pill badges (green Yes / slate No) with counts and percentages
- Card styling: white bg, rounded-xl, shadow-sm. Question number in primary-colored circle. Type badge pill. Response count in top-right.

### 3. `src/components/audience-survey/generateAudienceSurveyReport.ts`
- Client-side .docx generation using `docx` npm library (install if needed)
- Builds document with: Title, Executive Summary (auto-generated from top findings), Key Metrics table, then Q1-Q13 sections each with a response distribution table and auto-generated key finding
- `generateKeyFinding()` helper: highlights dominant response (>60%), close races (<10% gap), or default leader statement
- Downloads as `audience-survey-report-YYYY-MM-DD.docx`

## Modified Files

### 4. `src/components/audience-survey/AudienceSurveyInsightsDashboard.tsx`
- Add `'responses'` to `TabValue` type
- Add new tab trigger: `<TabsTrigger value="responses">Script Responses <Badge>{records.length}</Badge></TabsTrigger>` with `ClipboardList` icon
- Add `<TabsContent value="responses">` rendering `<ScriptResponsesTab records={records} />`

## Technical Details

- All aggregation reuses existing `aggregateArray`, `aggregateBoolean`, `formatAggLabels` from the hook/utils
- `normalizeLabel()` applied to all values before counting (synonym merging)
- `capSlices()` applied to questions with 8+ unique answers
- Bar widths calculated as `(count / maxCount) * 100%` so the top bar is always full width
- The .docx report uses `WidthType.DXA` for tables (not percentage), US Letter page size
- No database changes needed — purely frontend

