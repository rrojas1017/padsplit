

# Fix: Coaching Engagement Page Slow Loading

## Root Cause

Both `useCoachingData` and `useQACoachingData` fetch **every record** from `booking_transcriptions` (paginating 1000 at a time for Jeff's data), downloading full `agent_feedback` JSON blobs for all historical records. The page defaults to "today" but filters client-side after loading everything. As data grows, this gets progressively slower.

## Solution

Create a dedicated lightweight hook for the Coaching Engagement page that:
1. Only fetches the columns needed (audio URLs, listened timestamps — no `agent_feedback` JSON)
2. Applies date filtering at the database level
3. Runs a single query instead of paginated loops

## Changes

### 1. New hook: `src/hooks/useCoachingEngagementData.ts`
- Single query to `booking_transcriptions` selecting only: `booking_id`, `coaching_audio_url`, `coaching_audio_listened_at`, `qa_coaching_audio_url`, `qa_coaching_audio_listened_at`, plus `bookings(booking_date, agent_id)`
- Accepts `dateRange` and `customDates` as parameters to filter server-side via `.gte()` / `.lte()` on `bookings.booking_date`
- Only fetches rows where at least one audio URL exists (`.or('coaching_audio_url.not.is.null,qa_coaching_audio_url.not.is.null')`)
- Returns lightweight typed arrays for Jeff and Katty engagement data

### 2. Update `src/pages/CoachingEngagement.tsx`
- Replace `useCoachingData({ includeAudio: true })` and `useQACoachingData()` with the new `useCoachingEngagementData({ dateRange, customDates })`
- Remove client-side date filtering logic (lines ~95-128) since it's now server-side
- Keep all existing UI, charts, and quiz result logic unchanged

### Impact
- Instead of fetching thousands of full records with large JSON, fetches only rows with audio and only the 4-5 small columns needed
- Date filtering at DB level means "today" loads near-instantly
- No changes to any other page — MyPerformance, MyQA, CoachingHub all keep their existing hooks

