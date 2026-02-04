

## Bulk Transcription Processing Plan for 5,013 Records

### Overview

Process the backlog of 5,013 records with **conditional coaching audio generation**:
- **Vixicom agents (394 records)**: Full pipeline - Transcription → Jeff Audio → QA → Katty Audio
- **Non-Vixicom agents (4,619 records)**: Transcription + QA only - No TTS audio generation

This approach significantly reduces costs since ElevenLabs TTS is the most expensive component.

---

### Current State

| Site | Type | Pending Records | Audio Processing |
|------|------|-----------------|------------------|
| **Vixicom** | Outsourced | 394 | ✅ Full pipeline (Jeff + Katty) |
| **PadSplit Internal** | Internal | 4,619 | ⚠️ Transcription + QA only |
| **Total** | - | **5,013** | - |

---

### Revised Cost Estimate

| Service | Vixicom (394) | Non-Vixicom (4,619) | Total |
|---------|--------------|---------------------|-------|
| Deepgram STT | ~$12 | ~$143 | ~$155 |
| Lovable AI (Analysis) | ~$2 | ~$23 | ~$25 |
| ElevenLabs TTS (Jeff) | ~$60 | $0 | ~$60 |
| ElevenLabs TTS (Katty) | ~$40 | $0 | ~$40 |
| **Total** | ~$114 | ~$166 | **~$280** |

**Cost savings vs full pipeline: ~$900-1,100**

---

### Implementation Steps

#### Step 1: Create Database Table for Job Tracking

New `bulk_processing_jobs` table to track processing state and allow pause/resume:

```text
┌──────────────────────────────────────────────────────────────────┐
│ bulk_processing_jobs                                              │
├──────────────────────────────────────────────────────────────────┤
│ id (uuid)                 - Primary key                          │
│ job_name (text)           - Human-readable name                  │
│ status (text)             - pending | running | paused | done    │
│ total_records (int)       - Total to process                     │
│ processed_count (int)     - Successfully processed               │
│ failed_count (int)        - Failed records                       │
│ skipped_count (int)       - Skipped (no audio link)             │
│ current_booking_id (uuid) - Currently processing                 │
│ site_filter (text)        - 'vixicom_only' | 'non_vixicom' | all │
│ include_tts (boolean)     - Whether to generate coaching audio   │
│ pacing_seconds (int)      - Delay between records (default: 10)  │
│ error_log (jsonb[])       - Array of error details               │
│ started_at (timestamp)    - When processing started              │
│ completed_at (timestamp)  - When finished                        │
│ created_by (uuid)         - User who started                     │
│ created_at (timestamp)    - Job creation time                    │
└──────────────────────────────────────────────────────────────────┘
```

#### Step 2: Create New Edge Function

New `bulk-transcription-processor` edge function with:

**Key Features:**
- **Conditional TTS generation** based on agent's site (Vixicom vs. other)
- Configurable pacing (5-15 seconds between records)
- Background processing with `EdgeRuntime.waitUntil()`
- Real-time progress updates via database
- Pause/resume support
- Automatic retry for 402 (quota) errors

**Processing Logic:**
```text
For each booking:
1. Fetch booking with agent → site relationship
2. Check if site = 'Vixicom' (outsourced)
3. Call transcribe-call → Always runs
4. Call generate-coaching-audio → Only if Vixicom
5. Call generate-qa-scores → Always runs
6. Call generate-qa-coaching-audio → Only if Vixicom
7. Update job progress
```

#### Step 3: Modify Transcribe-Call Auto-Trigger

Update `transcribe-call/index.ts` (lines 1464-1514) to check site before triggering TTS:

**Current behavior:** Always triggers Jeff + Katty audio after transcription
**New behavior:** Only trigger TTS functions if agent belongs to Vixicom site

```typescript
// Lines 1458-1515 - Add site check before TTS
const isVixicomAgent = siteId && await checkIsVixicomSite(supabase, siteId);

// Only generate Jeff audio for Vixicom agents
if (isVixicomAgent) {
  fetch(`${supabaseUrl}/functions/v1/generate-coaching-audio`, {...})
}

// QA scoring still runs for everyone
const qaResponse = await fetch(`${supabaseUrl}/functions/v1/generate-qa-scores`, {...});

// Only generate Katty audio for Vixicom agents
if (qaResponse.ok && isVixicomAgent) {
  fetch(`${supabaseUrl}/functions/v1/generate-qa-coaching-audio`, {...})
}
```

#### Step 4: Add Bulk Processing UI Tab

New tab in `src/pages/HistoricalImport.tsx`:

```text
┌─────────────────────────────────────────────────────────────────┐
│ [HubSpot Import] [Phone Enrichment] [Bulk Processing] ← NEW     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Pending Transcriptions Summary                                   │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│ │ Vixicom      │  │ PadSplit     │  │ Total        │            │
│ │ 394 pending  │  │ 4,619 pending│  │ 5,013 pending│            │
│ │ Full pipeline│  │ STT only     │  │ ~14 hours    │            │
│ └──────────────┘  └──────────────┘  └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Start New Job                                                    │
├─────────────────────────────────────────────────────────────────┤
│ Wave: [Vixicom Only ▼] or [Non-Vixicom Only ▼] or [All Records] │
│ Pacing: [10 seconds ▼]  (5-30 seconds between records)          │
│ Include TTS Audio: [✓] Auto-detect based on site                │
│                                                                  │
│ Est. Time: ~1 hour (394 records)                                │
│ Est. Cost: ~$114                                                 │
│                                                                  │
│ [▶ Start Processing]                                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Active Job: "Vixicom Wave 1"                    [Pause] [Stop]  │
├─────────────────────────────────────────────────────────────────┤
│ ████████████████████░░░░░░░░░░░░░░░░░░░░  45% (177/394)        │
│ Processing: John Smith - booking abc123                         │
│ Errors: 2 | ETA: 36 minutes                                     │
│                                                                  │
│ [View Error Log]                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| **Database Migration** | Create | `bulk_processing_jobs` table |
| `supabase/functions/bulk-transcription-processor/index.ts` | Create | New edge function for bulk processing |
| `supabase/config.toml` | Modify | Add new function config |
| `supabase/functions/transcribe-call/index.ts` | Modify | Add Vixicom check before TTS triggers |
| `src/pages/HistoricalImport.tsx` | Modify | Add "Bulk Processing" tab |
| `src/components/import/BulkProcessingTab.tsx` | Create | New UI component |
| `src/hooks/useBulkProcessingJobs.ts` | Create | Hook for job polling |

---

### Recommended Execution Strategy

**Phase 1: Vixicom First (Day 1)**
- Start with 394 Vixicom records (full pipeline)
- Validates system stability before scaling
- Estimated time: ~1.5 hours at 10s pacing
- Allows agents who actively use the system to get coaching immediately

**Phase 2: Non-Vixicom (Day 1-2)**
- Process 4,619 PadSplit Internal records (transcription + QA only)
- No TTS audio generation = faster processing
- Estimated time: ~13 hours at 10s pacing
- Can run overnight with pause capability

---

### Error Handling

| Error | Action | Retry? |
|-------|--------|--------|
| HTTP 402 (Quota/Payment) | Pause job, create admin notification | Yes, after 5 min |
| HTTP 404 (Audio not found) | Log error, skip to next record | No |
| HTTP 403 (Access denied) | Log error, skip to next record | No |
| HTTP 500 (Server error) | Retry with backoff | Yes, up to 3x |
| Timeout | Retry with backoff | Yes, up to 2x |

---

### Technical Details

#### Vixicom Site Detection

The system will use the existing agent → site relationship:

```sql
-- Check if agent belongs to Vixicom
SELECT s.name ILIKE '%vixicom%' as is_vixicom
FROM agents a
JOIN sites s ON a.site_id = s.id
WHERE a.id = :agent_id
```

#### Bulk Processor Flow

```text
Start Job
    │
    ▼
┌─────────────────────────────┐
│ Fetch pending bookings      │
│ (filter by site if set)     │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ For each booking:           │◄──────────────┐
│ 1. Check job status         │               │
│    (paused? stopped?)       │               │
│ 2. Get agent's site         │               │
│ 3. Call transcribe-call     │               │
│ 4. If Vixicom: call TTS     │               │
│ 5. Update progress          │               │
│ 6. Wait pacing delay        │               │
└─────────────┬───────────────┘               │
              │                               │
              ▼                               │
    [More records?] ──Yes─────────────────────┘
              │
             No
              │
              ▼
    Mark job 'completed'
```

---

### Implementation Order

1. **Create database table** - Migration for `bulk_processing_jobs`
2. **Modify transcribe-call** - Add Vixicom site check before TTS
3. **Create bulk processor edge function** - New function with all features
4. **Create UI components** - BulkProcessingTab + hook
5. **Add tab to HistoricalImport** - Wire everything together
6. **Test with small batch** - 10 Vixicom records first
7. **Full Vixicom processing** - 394 records
8. **Full Non-Vixicom processing** - 4,619 records

