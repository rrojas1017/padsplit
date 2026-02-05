
# DeepSeek Integration Plan

## Overview

This plan adds DeepSeek as a new AI provider for call analysis, following the proven A/B testing pattern already established for STT providers (ElevenLabs vs Deepgram). The integration will allow side-by-side quality comparison before committing to any production changes.

---

## Architecture Summary

### Current State
- **STT Providers:** ElevenLabs (0% weight) vs Deepgram (100% weight) via `stt_provider_settings` table
- **LLM Provider:** Lovable AI Gateway only (Gemini Flash/Pro)
- **Cost Tracking:** `api_costs` table logs all provider usage with `service_provider` field

### Target State
- Add `deepseek` as a new LLM provider alongside `lovable_ai`
- Create `llm_provider_settings` table (mirrors `stt_provider_settings` pattern)
- Create `llm_quality_comparisons` table for A/B testing results
- Build comparison edge function + UI panel (mirrors STT pattern)

---

## Pricing Reference (DeepSeek V3.2)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| deepseek-chat (cache miss) | $0.27 | $1.10 |
| deepseek-chat (cache hit) | $0.07 | $1.10 |

**Comparison to Current Gemini Pricing:**

| Model | Input | Output | Notes |
|-------|-------|--------|-------|
| Gemini 2.5 Pro | $1.25 | $10.00 | Current for 5+ min calls |
| Gemini 2.5 Flash | $0.30 | $2.50 | Current for < 5 min calls |
| DeepSeek Chat | $0.27 | $1.10 | ~70-90% cheaper on output |

---

## Implementation Steps

### Phase 1: Database Setup

**New Table: `llm_provider_settings`**
```text
id              uuid (PK)
provider_name   text (unique) - 'lovable_ai', 'deepseek'
is_active       boolean
weight          integer (0-100, A/B testing distribution)
api_config      jsonb (model preferences, etc.)
created_at      timestamptz
updated_at      timestamptz
```

**New Table: `llm_quality_comparisons`**
```text
id                       uuid (PK)
booking_id               uuid (FK to bookings, nullable)
transcription_text       text
call_duration_seconds    integer

-- Lovable AI (Gemini) results
gemini_analysis          jsonb
gemini_model             text
gemini_input_tokens      integer
gemini_output_tokens     integer
gemini_latency_ms        integer
gemini_estimated_cost    numeric

-- DeepSeek results
deepseek_analysis        jsonb
deepseek_model           text
deepseek_input_tokens    integer
deepseek_output_tokens   integer
deepseek_latency_ms      integer
deepseek_estimated_cost  numeric

comparison_notes         text
created_at               timestamptz
```

**Seed Data:**
```text
INSERT: lovable_ai, weight=100, is_active=true
INSERT: deepseek, weight=0, is_active=true
```

---

### Phase 2: Secret Configuration

**Required Secret:**
- `DEEPSEEK_API_KEY` - Your DeepSeek API key

This will be requested via the Lovable secrets system before proceeding with edge function deployment.

---

### Phase 3: Edge Function - compare-llm-providers

**Location:** `supabase/functions/compare-llm-providers/index.ts`

**Purpose:** Run the same transcription through both Gemini and DeepSeek, store results for comparison

**Logic Flow:**
1. Accept `bookingId` or raw `transcription` text
2. Fetch transcription from database if `bookingId` provided
3. Build the analysis prompt (reuse existing `buildDefaultPrompt` logic)
4. Call Lovable AI Gateway (Gemini) with the prompt
5. Call DeepSeek API directly with same prompt
6. Parse both JSON responses
7. Log costs to `api_costs` table for both providers
8. Store comparison in `llm_quality_comparisons` table
9. Return metrics for immediate display

**DeepSeek API Call Pattern:**
```text
POST https://api.deepseek.com/chat/completions
Headers:
  Authorization: Bearer ${DEEPSEEK_API_KEY}
  Content-Type: application/json
Body:
  model: 'deepseek-chat'
  messages: [system, user]
  stream: false
```

---

### Phase 4: Frontend - LLMComparisonPanel Component

**Location:** `src/components/ai-management/LLMComparisonPanel.tsx`

**Features (mirrors STTComparisonPanel):**
- List eligible bookings for comparison (transcribed but not LLM-compared)
- Run comparison button per booking
- Comparison history list with cost savings badges
- Side-by-side analysis viewer showing:
  - Gemini extracted fields vs DeepSeek extracted fields
  - Latency comparison
  - Token usage comparison
  - Estimated cost per provider
  - Quality notes field for manual review

---

### Phase 5: Provider Labels Update

**File:** `src/utils/providerLabels.ts`

Add DeepSeek to the provider/service label maps:
```text
SUPER_ADMIN_PROVIDER_LABELS:
  deepseek: 'DeepSeek'

GENERIC_PROVIDER_LABELS:
  deepseek: 'AI Services'

PROVIDER_BADGE_COLORS:
  deepseek: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20'
```

---

### Phase 6: Cost Logging Updates

**Files to Update:**
- Edge function cost helper to support `deepseek` as `service_provider`
- DeepSeek pricing calculation: `($0.27 × input_tokens / 1M) + ($1.10 × output_tokens / 1M)`

---

### Phase 7: Settings Page Integration

**File:** `src/pages/Settings.tsx`

Add the new LLMComparisonPanel to the AI Management tab, below the existing STTComparisonPanel:
```text
{/* LLM Quality Comparison */}
<div className="bg-card rounded-xl border border-border p-6 shadow-card">
  <LLMComparisonPanel />
</div>
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/compare-llm-providers/index.ts` | A/B comparison edge function |
| `src/components/ai-management/LLMComparisonPanel.tsx` | Comparison UI component |

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/config.toml` | Add `compare-llm-providers` function config |
| `src/utils/providerLabels.ts` | Add DeepSeek provider labels and colors |
| `src/pages/Settings.tsx` | Import and render LLMComparisonPanel |

## Database Migrations

1. Create `llm_provider_settings` table
2. Create `llm_quality_comparisons` table  
3. Insert seed data for providers (lovable_ai 100%, deepseek 0%)
4. Add RLS policies for admin access

---

## What This Does NOT Do (Yet)

- Does NOT switch production analysis to DeepSeek
- Does NOT modify `transcribe-call` or `reanalyze-call` functions
- Does NOT change any existing processing pipelines

This is strictly a comparison/testing integration. Production switching would be a separate, future phase after you've reviewed comparison results and confirmed quality parity.

---

## Next Steps After Approval

1. Request DEEPSEEK_API_KEY secret from you
2. Run database migrations
3. Create edge function
4. Build comparison UI
5. Deploy and test with a few sample calls
