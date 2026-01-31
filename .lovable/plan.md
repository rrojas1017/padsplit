

# AWS Transcribe A/B Testing Implementation

## Overview
Implement AWS Transcribe as an alternative STT provider alongside ElevenLabs, with A/B testing capabilities to compare accuracy, speed, and cost between providers.

## Current State Analysis

### Existing Infrastructure
- **Primary Provider**: ElevenLabs Scribe v1 at $0.034/min (Pro Plan)
- **Tracking**: `stt_provider` column already exists in `booking_transcriptions` table
- **Current Stats**: 584 calls transcribed with ElevenLabs, 71 with null provider
- **Secrets Available**: `ELEVENLABS_API_KEY`, `DEEPGRAM_API_KEY` (already configured!)

### Providers to Compare

| Provider | Price/Min | Key Strengths | Considerations |
|----------|-----------|---------------|----------------|
| **ElevenLabs** | ~$0.034 | Current provider, good accuracy | Higher cost |
| **AWS Transcribe** | ~$0.024 | 30% cheaper, speaker diarization | Requires S3 for batch |
| **Deepgram** | ~$0.0043 | **87% cheaper**, ultra-fast, Nova-3 model | Already have API key! |

**Recommendation**: Since you already have a `DEEPGRAM_API_KEY` configured, we should prioritize testing **Deepgram Nova-3** first (87% cost savings vs ElevenLabs, excellent accuracy on phone calls).

---

## Implementation Plan

### Step 1: Database Schema Updates

Add columns to track A/B testing metrics:

```sql
-- Add A/B testing configuration
ALTER TABLE booking_transcriptions 
ADD COLUMN IF NOT EXISTS stt_latency_ms INTEGER,
ADD COLUMN IF NOT EXISTS stt_word_count INTEGER,
ADD COLUMN IF NOT EXISTS stt_confidence_score NUMERIC(4,3);

-- Add provider selection setting
CREATE TABLE IF NOT EXISTS stt_provider_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  weight INTEGER DEFAULT 50, -- A/B split percentage
  api_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial providers
INSERT INTO stt_provider_settings (provider_name, weight) VALUES
  ('elevenlabs', 50),
  ('deepgram', 50);
```

### Step 2: Create Provider Abstraction Layer

Create a shared utility for STT providers in the edge function:

```text
supabase/functions/_shared/stt-providers.ts
├── STTProvider interface
├── ElevenLabsProvider (existing)
├── DeepgramProvider (new)
└── AWSTranscribeProvider (future)
```

**Provider Interface**:
```typescript
interface STTResult {
  transcription: string;
  words: Array<{ text: string; start: number; end: number; speaker?: string }>;
  durationSeconds: number;
  confidence?: number;
  latencyMs: number;
}

interface STTProvider {
  name: string;
  transcribe(audioBlob: Blob): Promise<STTResult>;
}
```

### Step 3: Implement Deepgram Provider

Deepgram's Nova-3 model offers:
- **87% lower cost** ($0.0043/min vs $0.034/min)
- Sub-200ms latency
- Excellent diarization for phone calls
- Direct audio upload (no S3 needed)

```typescript
// Deepgram implementation
async function transcribeWithDeepgram(audioBlob: Blob): Promise<STTResult> {
  const startTime = Date.now();
  
  const response = await fetch(
    'https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&diarize=true&language=en-US',
    {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'audio/wav',
      },
      body: audioBlob,
    }
  );
  
  const result = await response.json();
  const latencyMs = Date.now() - startTime;
  
  return {
    transcription: result.results.channels[0].alternatives[0].transcript,
    words: result.results.channels[0].alternatives[0].words,
    durationSeconds: result.metadata.duration,
    confidence: result.results.channels[0].alternatives[0].confidence,
    latencyMs,
  };
}
```

### Step 4: Implement AWS Transcribe Provider (Optional)

AWS Transcribe requires:
1. **AWS Credentials**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
2. **S3 Bucket**: For audio file storage (batch mode) OR streaming API

**Batch Mode** (simpler):
```typescript
// Upload audio to S3 → Start transcription job → Poll for result
async function transcribeWithAWS(audioBlob: Blob, bookingId: string) {
  // 1. Upload to S3
  const s3Key = `transcriptions/${bookingId}.wav`;
  await uploadToS3(audioBlob, s3Key);
  
  // 2. Start transcription job
  const job = await transcribeClient.send(
    new StartTranscriptionJobCommand({
      TranscriptionJobName: `booking-${bookingId}`,
      LanguageCode: 'en-US',
      MediaFormat: 'wav',
      Media: { MediaFileUri: `s3://bucket/${s3Key}` },
      Settings: { ShowSpeakerLabels: true, MaxSpeakerLabels: 2 },
    })
  );
  
  // 3. Poll for completion (or use SNS notification)
  // ...
}
```

### Step 5: A/B Testing Logic in Transcribe Function

Modify `supabase/functions/transcribe-call/index.ts`:

```typescript
// Select provider based on A/B weights
async function selectProvider(supabase: any): Promise<'elevenlabs' | 'deepgram' | 'aws'> {
  const { data: settings } = await supabase
    .from('stt_provider_settings')
    .select('provider_name, weight')
    .eq('is_active', true);
  
  const totalWeight = settings.reduce((sum, s) => sum + s.weight, 0);
  const random = Math.random() * totalWeight;
  
  let cumulative = 0;
  for (const setting of settings) {
    cumulative += setting.weight;
    if (random <= cumulative) return setting.provider_name;
  }
  
  return 'elevenlabs'; // fallback
}

// In processTranscription():
const selectedProvider = await selectProvider(supabase);
const startTime = Date.now();
let result: STTResult;

switch (selectedProvider) {
  case 'deepgram':
    result = await transcribeWithDeepgram(audioBlob);
    break;
  case 'aws':
    result = await transcribeWithAWS(audioBlob, bookingId);
    break;
  default:
    result = await transcribeWithElevenLabs(audioBlob);
}

// Save with metrics
await supabase.from('booking_transcriptions').upsert({
  booking_id: bookingId,
  call_transcription: result.transcription,
  stt_provider: selectedProvider,
  stt_latency_ms: result.latencyMs,
  stt_confidence_score: result.confidence,
  // ...other fields
});
```

### Step 6: Analytics Dashboard for A/B Results

Add a comparison view to see provider performance:

```typescript
// Query for A/B comparison
SELECT 
  stt_provider,
  COUNT(*) as total_calls,
  AVG(stt_latency_ms) as avg_latency,
  AVG(stt_confidence_score) as avg_confidence,
  AVG(call_duration_seconds) as avg_duration,
  SUM(estimated_cost_usd) as total_cost
FROM booking_transcriptions bt
LEFT JOIN api_costs ac ON ac.booking_id = bt.booking_id
WHERE stt_provider IS NOT NULL
  AND created_at > now() - interval '30 days'
GROUP BY stt_provider
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/_shared/stt-providers.ts` | CREATE | Provider abstraction layer |
| `supabase/functions/transcribe-call/index.ts` | MODIFY | Add multi-provider support and A/B logic |
| Database migration | CREATE | Add tracking columns and settings table |
| `src/utils/billingCalculations.ts` | MODIFY | Add Deepgram/AWS pricing constants |
| `src/pages/Billing.tsx` | MODIFY | Add provider comparison analytics |

---

## Cost Comparison (5,000 calls @ 10 min avg)

| Provider | Per-Min Rate | Total Cost | Savings vs ElevenLabs |
|----------|--------------|------------|----------------------|
| ElevenLabs | $0.034 | $1,700 | -- |
| AWS Transcribe | $0.024 | $1,200 | **29% ($500)** |
| Deepgram Nova-3 | $0.0043 | $215 | **87% ($1,485)** |

**For 5,000 historical imports**:
- Deepgram would save ~$1,485 compared to ElevenLabs
- Even at 50/50 A/B split: ~$742 savings

---

## Recommended Approach

Since you already have `DEEPGRAM_API_KEY` configured:

1. **Phase 1**: Add Deepgram provider to transcribe function (immediate 87% cost savings potential)
2. **Phase 2**: Run 50/50 A/B test for 2 weeks to validate accuracy
3. **Phase 3**: Analyze results and adjust weights or switch primary provider
4. **Phase 4** (optional): Add AWS Transcribe if neither meets needs

---

## Technical Requirements

### For Deepgram (Ready to go!)
- ✅ API key already configured
- No additional setup needed

### For AWS Transcribe (If needed later)
- AWS account with IAM credentials
- S3 bucket for audio storage
- Two new secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

