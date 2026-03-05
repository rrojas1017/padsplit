

# Research Insights — AI Analytics Engine (Prompts A, B, C)

## Overview

Build a 3-stage AI processing pipeline for move-out research transcripts, following the existing `analyze-member-insights` pattern (background processing with polling). 94 valid research records with transcripts are available today.

## Architecture

```text
Transcribed Record (bookings + booking_transcriptions where record_type='research')
        ↓
  PROMPT A (per record) — Extract structured data from transcript
        ↓
  PROMPT B (per record) — Classify: reason codes, preventability, addressability
        ↓
  Store extraction + classification in new DB columns
        ↓
  PROMPT C (on demand, batch) — Aggregate insight report
        ↓
  Store in research_insights table → Render on /research/insights page
```

## Phase 1: Database Changes

### New columns on `booking_transcriptions` table
- `research_extraction` (jsonb, default null) — Prompt A output
- `research_classification` (jsonb, default null) — Prompt B output  
- `research_processed_at` (timestamptz, default null) — when A+B completed
- `research_processing_status` (text, default null) — `processing` | `completed` | `failed`
- `research_human_review` (boolean, default false) — flagged by Prompt B

### New columns on `research_insights` table
Already has: `id`, `campaign_id`, `data` (jsonb), `insight_type`, `caller_type`, `generated_at`

Add:
- `status` (text, default 'processing') — `processing` | `completed` | `failed`
- `error_message` (text, nullable)
- `total_records_analyzed` (integer, default 0)
- `analysis_period` (text, nullable) — date filter used
- `date_range_start` (date, nullable)
- `date_range_end` (date, nullable)
- `created_by` (uuid, nullable)

### New table: `research_prompts`
Store editable prompts so the team can tune without code deploys.
- `id` (uuid, PK)
- `prompt_key` (text, unique) — `extraction`, `classification`, `aggregation`
- `prompt_text` (text) — the full prompt
- `temperature` (numeric, default 0.2)
- `model` (text, default 'google/gemini-2.5-pro')
- `version` (integer, default 1)
- `updated_at` (timestamptz)
- `updated_by` (uuid)

RLS: super_admin/admin can manage; supervisor can SELECT.

## Phase 2: Edge Functions

### `process-research-record/index.ts` (Prompts A + B, per record)
- Triggered manually or automatically after transcription completes for research records
- Fetches the transcript from `booking_transcriptions` for a given booking_id
- Runs Prompt A (extraction) → stores result in `research_extraction`
- Runs Prompt B (classification) on Prompt A output → stores in `research_classification`
- Sets `research_processed_at`, updates status
- Uses `google/gemini-2.5-pro` at temperature 0.2
- Includes retry logic for invalid JSON (same pattern as analyze-member-insights)
- Logs costs to `api_costs`
- If Prompt B sets `human_review_recommended: true`, sets `research_human_review = true`
- Config: `verify_jwt = true`

### `generate-research-insights/index.ts` (Prompt C, batch)
- Called on-demand from the Research Insights page
- Fetches all `research_classification` JSONs from `booking_transcriptions` (filtered by date range and campaign)
- Handles batch sizing: splits into chunks of 50 if >50 records
- Uses background processing pattern (`EdgeRuntime.waitUntil()`)
- Creates a `research_insights` row with `status: 'processing'`, returns ID immediately
- Runs Prompt C → parses response → stores in `research_insights.data`
- Uses `google/gemini-2.5-pro` at temperature 0.4
- Logs costs to `api_costs`
- Config: `verify_jwt = true`

### `batch-process-research-records/index.ts` (backfill)
- Processes all unprocessed research records (where `research_extraction IS NULL` and transcript exists)
- Self-retriggering chunked pattern (existing pattern in codebase)
- Processes 5 records per invocation, retriggers itself
- Config: `verify_jwt = true`

## Phase 3: Auto-trigger Integration

Modify `transcribe-call/index.ts` to call `process-research-record` after successful transcription of research records (fire-and-forget, same pattern as coaching pipeline).

## Phase 4: Research Insights Page UI

Replace the placeholder `ResearchInsights.tsx` with a full dashboard:

### Controls Bar
- Campaign filter (dropdown from `research_campaigns`)
- Date range filter (This Week, Last Month, This Month, Last 3 Months, All Time)
- "Generate Insights" button (triggers Prompt C)
- Export PDF button
- Previous analyses selector (same pattern as BookingInsightsTab)

### Processing Status
- Records processed counter: X of Y research records have been AI-processed
- "Process All Records" button for backfill
- In-progress banner with polling (reuse `useMemberInsightsPolling` pattern adapted for research)

### Insight Report Display (from Prompt C output)
Organized into collapsible card sections:

1. **Executive Summary** — headline, key stats (addressable %, preventability avg, regret distribution)
2. **Reason Code Distribution** — bar chart showing primary reason codes with counts
3. **Issue Clusters** — expandable cards per cluster with quotes, root cause, recommended action, priority badge
4. **Payment Friction Analysis** — dedicated card with extension gaps, miscommunication counts
5. **Transfer Friction Analysis** — awareness gap stats, retention opportunities
6. **Operational Blind Spots** — flagged items with detection recommendations
7. **Host Accountability Flags** — pattern cards with enforcement recommendations
8. **Agent Performance Summary** — coverage stats, coaching opportunities
9. **Top Actions** — ranked action items with priority, owner, effort badges
10. **Emerging Patterns** — watch/investigate/act badges
11. **Human Review Queue** — list of records flagged for human review with links

### Individual Record Viewer
- Expandable list of processed records showing extraction + classification
- Click to view full Prompt A + B output for any record
- Filter by reason code, addressability, preventability score

## Phase 5: Prompt Management (Settings)

Add a "Research Prompts" section in Settings (super_admin only):
- View/edit Prompt A, B, C text
- Adjust temperature and model per prompt
- Version tracking

## Technical Decisions

- **Model**: `google/gemini-2.5-pro` (already used for member insights, handles large context well)
- **No Anthropic/Claude**: The prompts reference Claude but we use Lovable AI gateway which supports Gemini and OpenAI. Using `google/gemini-2.5-pro` which is comparable for structured extraction
- **Cost**: ~94 records × 2 prompts × ~$0.025 = ~$4.70 for initial backfill; Prompt C batch ~$0.10 per run
- **Storage**: All outputs in existing tables (no new tables except `research_prompts`)
- **RLS**: Follows existing patterns — admin/super_admin can manage, supervisor can view

## Implementation Order

1. Database migrations (new columns + research_prompts table)
2. `process-research-record` edge function (Prompts A+B)
3. `generate-research-insights` edge function (Prompt C)
4. `batch-process-research-records` edge function (backfill)
5. Research Insights page UI with all panels
6. Auto-trigger integration in transcribe-call
7. Prompt management UI in Settings

This is a large feature — I recommend implementing it across multiple messages, starting with the database schema and edge functions, then the UI.

