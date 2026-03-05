

# Filter Research Processing to Valid Records Only

## Problem
The batch processing, aggregation, and stats queries currently include ALL research records with transcripts — including voicemails and brief non-conversations. Research records use `has_valid_conversation = true` (with a 120-second minimum duration) as the validity check.

## Changes

### 1. `batch-process-research-records/index.ts` — Add `has_valid_conversation` filter
- Line 33: Add `.eq('has_valid_conversation', true)` to the main query fetching unprocessed records

### 2. `generate-research-insights/index.ts` — Add `has_valid_conversation` filter
- Line 399: Add `.eq('has_valid_conversation', true)` to the query fetching processed records for Prompt C aggregation

### 3. `process-research-record/index.ts` — Add validity check before processing
- After fetching the transcript, also fetch the booking's `has_valid_conversation` flag
- If `has_valid_conversation` is not `true`, skip processing and return early with a clear message

### 4. `src/hooks/useResearchInsightsData.ts` — Fix stats to count only valid records
- Line 42: Add `.eq('has_valid_conversation', true)` to the total research records count query

### 5. `transcribe-call/index.ts` — Only trigger `process-research-record` for valid conversations
- In the auto-trigger section, check `hasValidConversation` before firing the downstream call

All five files need the same one-line filter addition. This ensures voicemails and brief attempts are excluded from AI extraction, classification, aggregation, and stats display.

