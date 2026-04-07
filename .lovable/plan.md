

# Add Jeff (Coach) Audio to Agent Views Alongside Katty (QA)

## Problem
Agents currently see Jeff the Coach only on the **My Performance** page and Katty the QA Coach only on the **My QA** page. Each booking should show both coaches side by side so agents can access all coaching in one place.

## Solution
Add Katty's QA coaching audio player to the **My Performance** page alongside Jeff's existing player, and add Jeff's coaching audio player to the **My QA** page alongside Katty's existing player. This way, regardless of which page the agent visits, they see both coaches for each booking.

## Changes

### 1. `src/pages/MyPerformance.tsx`
- Import `useQACoachingData` and `QACoachingAudioPlayer`
- Call `useQACoachingData({ agentId: myAgent?.id })` to fetch QA coaching data
- In the bookings list (line ~530), after Jeff's `CoachingAudioPlayer`, add Katty's `QACoachingAudioPlayer` by matching `bookingId`
- In the "Latest Coaching" card (line ~570), add Katty's player below Jeff's
- Label each player clearly: "Jeff (Coach)" and "Katty (QA)"

### 2. `src/pages/MyQA.tsx`
- Import `useCoachingData` and `CoachingAudioPlayer`
- Call `useCoachingData({ agentId: myAgent?.id, includeAudio: true })` to fetch Jeff's coaching data
- In the bookings list, after Katty's `QACoachingAudioPlayer`, add Jeff's `CoachingAudioPlayer` by matching `bookingId`
- Label each player: "Jeff (Coach)" and "Katty (QA)"

### 3. Both pages: Layout per booking row
Each booking entry will show a small two-row audio section:

```text
[ Member Name  |  Market  |  Date ]
  🎧 Jeff (Coach):  [▶ Play]
  🎧 Katty (QA):    [▶ Play]
```

This keeps the existing player components and just stacks them with labels.

