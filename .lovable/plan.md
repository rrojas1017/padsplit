
# Clean Up Today's Duplicate api_costs Entries

## What Was Found

3 bookings processed before the fix was deployed each have **10 cost entries** (5 service types × 2 due to the duplicate bug). The second (later) entry for each service type is the phantom duplicate — the real API call happened once, but it was logged twice.

**Duplicate entries to remove (15 total):**

Booking `ae922fa7` (5 duplicates):
- `c4296916` — ai_analysis — $0.013340
- `6ed6e88f` — ai_qa_scoring — $0.000161
- `cef845c8` — speaker_identification — $0.000068
- `74b282ea` — stt_transcription — $0.022647
- `5917d288` — transcript_polishing — $0.000458

Booking `bf0690ba` (5 duplicates):
- `1ff9e808` — ai_analysis — $0.022256
- `b0cdf615` — ai_qa_scoring — $0.000519
- `bf81da8f` — speaker_identification — $0.000068
- `79bee82f` — stt_transcription — $0.111513
- `375abe30` — transcript_polishing — $0.001787

Booking `da2dc469` (5 duplicates):
- `5941bde0` — ai_analysis — $0.013551
- `b9123b3c` — ai_qa_scoring — $0.000160
- `2233b86c` — speaker_identification — $0.000068
- `ed13b8a4` — stt_transcription — $0.022647
- `d68ba3e3` — transcript_polishing — $0.000458

**Total phantom cost removed: ~$0.209 logged dollars** (actual Deepgram/API spend was $0 extra — only the cost log doubled, not the actual charges)

## Approach: Mark as Internal (not delete)

Rather than hard-deleting, the duplicates will be marked `is_internal = true`. This:
- Removes them from all billing calculations (the hook already filters `is_internal = false`)
- Preserves the audit trail so the data is never truly lost
- Is fully reversible if needed

## Implementation

A single `UPDATE` on `api_costs` targeting the 15 specific IDs by their exact UUIDs:

```sql
UPDATE api_costs
SET is_internal = true
WHERE id IN (
  'c4296916-2291-40be-b6e1-27b99ffd13ad',
  '6ed6e88f-9a10-47d5-9610-bbc3af1175ad',
  'cef845c8-fb74-4052-a334-719a7d56def7',
  '74b282ea-1a1e-4f4e-9b67-37cf402ec1ad',
  '5917d288-12ba-4ebd-bb3a-09d1ff736bf4',
  '1ff9e808-4231-4fbd-94f9-9dc501ff5c41',
  'b0cdf615-92ab-43b9-808f-4f700b7ff1b4',
  'bf81da8f-fcc3-4744-8124-c05b863a9399',
  '79bee82f-6255-4502-8d62-17e10b8d5326',
  '375abe30-9a48-4e80-ba2d-6f589ff892a0',
  '5941bde0-4ed1-49e1-ac74-fc850fbf28c1',
  'b9123b3c-a9f4-4fee-a1d9-b5f23855fe95',
  '2233b86c-c1e3-48f3-a477-30466eed42e5',
  'ed13b8a4-1f8c-438d-8cf0-b341dd1cc4f9',
  'd68ba3e3-4189-4bab-a9ee-6e37c6ea8ae5'
);
```

## Expected Result After Cleanup

| Booking | Before (entries) | After (entries) | Before (cost) | After (cost) |
|---|---|---|---|---|
| ae922fa7 | 10 | 5 | ~$0.061 | ~$0.036 |
| bf0690ba | 10 | 5 | ~$0.252 | ~$0.115 |
| da2dc469 | 10 | 5 | ~$0.061 | ~$0.036 |
| **Total** | **30** | **15** | **~$0.373** | **~$0.187** |

The billing dashboard today-view will drop from ~$0.374 to ~$0.187, with a corrected avg cost-per-booking of ~$0.062 — well within the expected $0.047–$0.070 range.

## No Code Changes Required

This is a pure data fix via a single SQL `UPDATE`. No frontend or edge function changes are needed.
