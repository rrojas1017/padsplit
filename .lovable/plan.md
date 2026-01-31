

# Batch Re-transcribe 9 Uncorrected Deepgram Transcripts

## Overview

Re-process 9 Deepgram transcripts that still contain uncorrected brand mishearings from before the pipeline fix was deployed.

---

## Affected Bookings

| # | Booking ID | Member | Date | Mishearing |
|---|------------|--------|------|------------|
| 1 | `7e6fa939...` | Keshunna Mills | Nov 26 | pathway |
| 2 | `cb4eda18...` | Maribel Campa | Nov 26 | bad supplies |
| 3 | `53b728db...` | Bryan Taylor | Nov 26 | pagespeed |
| 4 | `eed4c732...` | Shadrack Suyanka | Nov 26 | pathway |
| 5 | `63bfa223...` | Darrell Waddell | Nov 26 | bad supplies |
| 6 | `2f55aee9...` | Demetric Parker | Nov 26 | bad supplies |
| 7 | `4be4b230...` | Adam Taylor | Nov 26 | path to place |
| 8 | `d3f9ddae...` | Lawrence Barr | Nov 25 | pathway |
| 9 | `67e2a611...` | Terika Shabazz | Nov 25 | pathway |

---

## Implementation

### Approach

Use the existing `batch-retry-transcriptions` edge function to re-process these specific bookings. The function will:

1. Reset transcription status to `pending`
2. Call `transcribe-call` for each booking
3. Apply 30-second pacing between requests to avoid rate limiting
4. The updated pipeline will now correctly apply polishing AFTER speaker identification

### Execution

Call the edge function with the 9 booking IDs:

```json
{
  "bookingIds": [
    "7e6fa939-b5d4-4676-90e9-88613b81ed5b",
    "cb4eda18-39d7-4b58-94a7-8b4701a3d547",
    "53b728db-afbe-4a43-a7c6-f5d7f8d4b2a7",
    "eed4c732-0ea8-4b21-8b2f-7db7a8b566eb",
    "63bfa223-19f6-4baf-8fd7-3b92cfe00176",
    "2f55aee9-da4b-4e04-a524-8165fc7559f4",
    "4be4b230-bcb8-4281-9e4b-f1bd6bb02935",
    "d3f9ddae-f1a1-4c6f-a067-b2783ff57add",
    "67e2a611-5530-4fd2-9a45-7a9fd1960cea"
  ]
}
```

---

## Expected Outcome

| Before | After |
|--------|-------|
| "pathway" | "PadSplit" |
| "bad supplies" | "PadSplit" |
| "pagespeed" | "PadSplit" |
| "path to place" | "PadSplit" |
| "pad split" | "PadSplit" |

---

## Processing Time

- 9 bookings × 30 seconds pacing = ~4.5 minutes total
- Background processing, immediate response

---

## Verification

After processing completes, run a follow-up query to confirm all mishearings have been corrected:

```sql
SELECT COUNT(*) FROM booking_transcriptions 
WHERE stt_provider = 'deepgram' 
AND call_transcription ILIKE ANY(ARRAY['%pathway%', '%bad supplies%', '%pagespeed%', '%path to place%', '%pad split%'])
```

Expected result: 0 uncorrected transcripts

