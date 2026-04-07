

# Coaching Engagement Tracking, Reminders & Admin Toggle

## What We're Building

Three capabilities:
1. **Quiz completion tracking** on the Coaching Engagement dashboard — admins see not just "listened" but also "quiz passed" per agent, for both Jeff and Katty
2. **Agent reminders** — a banner on agent pages (My Performance, My QA, My Bookings) showing how many coaching sessions still need listening + quiz completion
3. **Admin toggle** — super_admin/admin can enable or disable the quiz requirement feature from Settings

## Database Changes

### New table: `coaching_settings`
```sql
CREATE TABLE coaching_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_enforcement_enabled boolean NOT NULL DEFAULT true,
  reminder_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);
-- Seed one row
INSERT INTO coaching_settings (quiz_enforcement_enabled, reminder_enabled) VALUES (true, true);
-- RLS: admins can read/update, all authenticated can read
```

This single-row config table controls whether the quiz prompt appears after audio playback and whether reminder banners show.

## Frontend Changes

### 1. Settings page — new "Coaching Enforcement" card
- Add a card in the AI Management tab with two toggles:
  - **Quiz Required After Listening** — when off, the quiz modal does not auto-open after audio ends
  - **Show Reminder Banners** — when off, agents don't see the "you have X pending" banner
- Reads/writes to `coaching_settings` table
- Only visible to super_admin/admin

### 2. Coaching Engagement dashboard — add quiz columns
- Extend `AgentEngagementStats` with `jeffQuizPassed`, `kattyQuizPassed` counts
- Query `coaching_quiz_results` grouped by agent to get pass counts
- Add "Quiz Passed" sub-columns under Jeff and Katty in the table
- Add two new summary cards: "Jeff Quizzes Passed" and "Katty Quizzes Passed"

### 3. Agent reminder banner component
- New `CoachingReminderBanner.tsx` component
- Queries `booking_transcriptions` for the logged-in agent's bookings where coaching audio exists but `coaching_audio_listened_at` is null OR `coaching_quiz_passed_at` is null
- Shows: "You have X coaching sessions and Y QA sessions pending review"
- Checks `coaching_settings.reminder_enabled` before rendering
- Placed in `MyPerformance.tsx`, `MyQA.tsx`, and `MyBookings.tsx`

### 4. Quiz modal conditional trigger
- In `CoachingAudioPlayer.tsx` and `QACoachingAudioPlayer.tsx`, the `handleEnded` callback checks `coaching_settings.quiz_enforcement_enabled` before opening the quiz modal
- Create a shared hook `useCoachingSettings()` that fetches and caches the settings row

### 5. Hook: `useCoachingSettings`
- Fetches the single row from `coaching_settings`
- Returns `{ quizEnforcementEnabled, reminderEnabled, isLoading }`
- Used by audio players, reminder banner, and settings page

## File Summary

| File | Change |
|------|--------|
| Migration | Create `coaching_settings` table with RLS |
| `src/hooks/useCoachingSettings.ts` | New hook |
| `src/components/coaching/CoachingReminderBanner.tsx` | New reminder banner |
| `src/pages/Settings.tsx` | Add coaching enforcement toggles card |
| `src/pages/CoachingEngagement.tsx` | Add quiz pass columns + summary cards |
| `src/components/coaching/CoachingAudioPlayer.tsx` | Gate quiz trigger on setting |
| `src/components/qa/QACoachingAudioPlayer.tsx` | Gate quiz trigger on setting |
| `src/pages/MyPerformance.tsx` | Add reminder banner |
| `src/pages/MyQA.tsx` | Add reminder banner |
| `src/pages/MyBookings.tsx` | Add reminder banner |

