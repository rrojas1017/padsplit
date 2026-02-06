

# Real-Time Cost Monitoring Dashboard with LLM Cost Calculator

## Overview
Create a comprehensive cost monitoring and projection system within the existing Cost & Billing section. This includes:
1. **Live Cost Monitor** - Real-time TTS vs STT spending with anomaly alerts
2. **LLM Cost Calculator** - Toggle between provider configurations to project costs for different intake methods

## Architecture

```text
[Billing.tsx - New "Live Monitor" Tab]
        |
        +-- RealtimeCostDashboard
        |       |
        |       +-- Live TTS/STT/AI spend cards with alerts
        |       +-- 60-minute stacked area trend chart
        |       +-- Recent activity feed
        |
        +-- LLMCostCalculator
                |
                +-- Intake Method Selector (Uploads vs Recordings)
                +-- Provider Configuration Toggles
                |       - STT: Deepgram ($0.0043/min) vs ElevenLabs ($0.034/min)
                |       - LLM: DeepSeek (~$0.0007/call) vs Gemini (~$0.009/call)
                |       - TTS: Enabled ($0.18/call) vs Disabled ($0)
                +-- Volume Inputs (records per month, avg call duration)
                +-- Cost Projection Output
```

## Features

### 1. Live Cost Monitor (Real-Time Dashboard)

**Live Cost Cards (4-card grid)**:
| Card | Metric | Alert Threshold |
|------|--------|-----------------|
| TTS Spend | Last hour ElevenLabs TTS cost | Critical if > $2/hr or > 30% of total |
| STT Spend | Last hour Deepgram + ElevenLabs STT cost | Normal (always expected) |
| AI Spend | Last hour DeepSeek + Gemini analysis cost | Warning if Gemini > 50% (hybrid mode should use DeepSeek) |
| Total | Combined hourly cost | Shows cost/minute rate |

**Visual Elements**:
- Pulsing green "LIVE" indicator when data is fresh
- Red/amber border on cards when thresholds exceeded
- Alert banner with specific message when anomaly detected

**60-Minute Trend Chart**:
- Stacked area chart showing minute-by-minute breakdown
- Colors: TTS (red), STT (blue), AI (purple)
- Tooltip showing exact values per service

**Recent Activity Feed**:
- Last 10 api_costs entries with service type, cost, and time ago
- Color-coded badges by provider

### 2. LLM Cost Calculator

**Intake Method Tabs**:
- **Uploads** - Historical imports (no live recording, just transcription + analysis)
- **Recordings** - Live Kixie calls (full pipeline including optional TTS coaching)

**Provider Configuration Toggles**:

| Service | Option A | Option B | Default |
|---------|----------|----------|---------|
| STT Provider | Deepgram ($0.0043/min) | ElevenLabs ($0.034/min) | Deepgram |
| LLM Provider | DeepSeek (~$0.0007/call) | Gemini Flash (~$0.009/call) | DeepSeek (Hybrid) |
| AI Polish | Enabled ($0.0006/call) | Disabled | Enabled |
| Jeff Coaching Audio | Enabled (~$0.18/call) | Disabled | Disabled |
| Katty QA Audio | Enabled (~$0.16/call) | Disabled | Disabled |
| QA Scoring | Enabled ($0.0001/call) | Disabled | Enabled |

**Volume Inputs**:
- Records per month (slider: 100 - 10,000)
- Average call duration (slider: 1 - 30 minutes)
- Percentage Non-Booking calls (slider: 0 - 100%) - affects Gemini fallback costs

**Cost Projection Output**:
- Monthly cost estimate with breakdown pie chart
- Cost per record
- Cost per minute of talk time
- Comparison panel showing "current config" vs "optimized config" savings

**Preset Configurations**:
- "Economy Mode" - DeepSeek + Deepgram, no TTS
- "Quality Mode" - Gemini + Deepgram, no TTS
- "Full Audio" - Gemini + Deepgram + All TTS enabled
- "Current Config" - Loads from llm_provider_settings and stt_provider_settings tables

## Files to Create

### 1. `src/hooks/useRealtimeCostMonitor.ts`
Hook for real-time cost data management

**Key Features**:
- Fetches last 60 minutes of api_costs aggregated by minute
- Subscribes to Supabase Realtime INSERT events on api_costs table
- Polls every 30 seconds for consistency
- Calculates alert levels based on TTS thresholds
- Classifies costs by service type:
  - TTS: `service_type.startsWith('tts_')`
  - STT: `service_type.startsWith('stt_')` or `service_type === 'stt_transcription'`
  - AI: `service_type.startsWith('ai_')` or `service_type.includes('analysis')`

**Return Interface**:
```typescript
interface RealtimeCostData {
  lastHourTTS: number;
  lastHourSTT: number;
  lastHourAI: number;
  lastHourTotal: number;
  ttsPercentage: number;
  costPerMinute: number;
  minuteTrend: Array<{ minute: string; tts: number; stt: number; ai: number }>;
  recentCosts: ApiCost[];
  alertLevel: 'normal' | 'warning' | 'critical';
  alertMessage: string;
  isLive: boolean;
  lastUpdated: Date;
}
```

### 2. `src/components/billing/RealtimeCostDashboard.tsx`
Main real-time monitoring dashboard component

**Layout**:
- 4-card grid showing TTS, STT, AI, and Total spend
- Alert banner (conditional, shows when alert detected)
- Stacked area chart for 60-minute trend
- Recent activity feed (scrollable list)

**Styling**:
- Matches existing billing dashboard patterns
- Uses Recharts for charts (already in project)
- Radix UI components for cards and badges

### 3. `src/components/billing/LLMCostCalculator.tsx`
Cost projection calculator with provider toggles

**Key Features**:
- Tabs for "Uploads" vs "Recordings" intake methods
- Switch components for each service toggle
- Slider inputs for volume projections
- Real-time cost calculation as inputs change
- Pie chart breakdown of projected costs
- "Load Current Config" button to pull settings from database

**Pricing Constants** (from billingCalculations.ts + actual api_costs data):
```typescript
const CALCULATOR_PRICING = {
  stt: {
    deepgram: 0.0043,      // per minute
    elevenlabs: 0.034,     // per minute
  },
  llm: {
    deepseek: 0.0007,      // avg per call (from actual data)
    gemini_flash: 0.009,   // avg per call
    gemini_pro: 0.04,      // for complex calls >5min
  },
  polish: 0.0006,          // per call (flash-lite)
  tts: {
    jeff_coaching: 0.18,   // avg per call
    katty_qa: 0.16,        // avg per call
  },
  qa_scoring: 0.0001,      // per call
  speaker_id: 0.00007,     // per call
};
```

### 4. Update `src/pages/Billing.tsx`
Modify to add new tab and import components

**Changes**:
- Add "Live Monitor" tab (TabsTrigger with Activity icon)
- Add corresponding TabsContent with RealtimeCostDashboard and LLMCostCalculator
- Update TabsList grid from 3 to 4 columns

### 5. Update `src/utils/billingCalculations.ts`
Add new pricing constants and calculator utilities

**New Exports**:
- `CALCULATOR_PRICING` object with all provider rates
- `calculateProjectedCost()` function for calculator
- `formatDuration()` helper for minute/hour display

### 6. Database Migration
Enable realtime for api_costs table

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.api_costs;
```

## Integration Points

- Uses existing Supabase client from `src/integrations/supabase/client.ts`
- Uses existing Recharts library for charts
- Uses existing date-fns for date formatting
- Protected by super_admin role check (already in Billing.tsx)
- Fetches current settings from `llm_provider_settings` and `stt_provider_settings` tables

## Alert Thresholds

| Level | TTS Condition | AI Condition |
|-------|---------------|--------------|
| Critical | > $2/hr OR > 30% of total | N/A |
| Warning | > $0.50/hr OR > 10% of total | Gemini > 50% when hybrid mode enabled |
| Normal | TTS near $0 | DeepSeek handling bulk |

## Performance Considerations

- Realtime subscription only syncs INSERT events (not full table scans)
- Polling interval: 30 seconds (balances freshness with database load)
- Query limited to last 60 minutes (~60 data points)
- Calculator uses client-side computation only (no API calls for projections)

