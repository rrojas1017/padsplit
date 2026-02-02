
# Extract Market Information from Call Transcriptions

## Problem Summary
- **5,163 imported records** have no market data (city/state)
- **105 of those** have completed transcriptions with market info in the audio
- Market locations are mentioned in calls (e.g., "Houston", "Tampa", "Lawrenceville", "Stone Mountain")
- Current AI analysis extracts `propertyAddress` but not explicit city/state fields

## Solution Overview

### Part 1: Enhance Future Transcriptions
Update the AI analysis prompt in `transcribe-call/index.ts` to extract `marketCity` and `marketState` explicitly as new fields in `memberDetails`. After transcription, automatically update the booking's `market_city` and `market_state` fields when they are empty but extracted from the call.

### Part 2: Backfill Existing Transcriptions
Create a new edge function `backfill-markets-from-transcriptions` that:
1. Finds bookings with completed transcriptions but missing market data
2. Uses AI to extract city/state from the transcription or summary
3. Updates the booking record with the extracted market info

---

## Technical Implementation

### 1. Update AI Analysis Prompt (transcribe-call/index.ts)

Add to the `memberDetails` schema in both `buildDynamicPrompt` and `buildDefaultPrompt`:

```typescript
"memberDetails": {
  // ... existing fields ...
  "propertyAddress": "string or null",
  "marketCity": "string or null - the city name where the property is located (e.g., 'Atlanta', 'Houston', 'Tampa')",
  "marketState": "string or null - the US state abbreviation (e.g., 'GA', 'TX', 'FL')"
}
```

### 2. Auto-Update Booking Markets After Transcription

After successful analysis, if the booking has no market data but the AI extracted it:

```typescript
// After saving transcription, check for market enrichment
const memberDetails = keyPoints?.memberDetails;
if (memberDetails?.marketCity || memberDetails?.marketState) {
  // Check if booking needs market data
  const { data: booking } = await supabase
    .from('bookings')
    .select('market_city, market_state')
    .eq('id', bookingId)
    .single();
  
  if (!booking?.market_city && memberDetails.marketCity) {
    await supabase
      .from('bookings')
      .update({
        market_city: memberDetails.marketCity,
        market_state: memberDetails.marketState || null
      })
      .eq('id', bookingId);
    console.log(`[Background] Market enriched: ${memberDetails.marketCity}, ${memberDetails.marketState}`);
  }
}
```

### 3. New Edge Function: backfill-markets-from-transcriptions

```text
supabase/functions/backfill-markets-from-transcriptions/index.ts
```

**Logic:**
1. Query bookings with `transcription_status = 'completed'` AND (`market_city IS NULL OR market_city = ''`)
2. For each booking, fetch transcription from `booking_transcriptions`
3. Use a lightweight AI call to extract city/state from the transcription or summary
4. Update the `bookings.market_city` and `bookings.market_state` fields
5. Process in batches with 10-second delays (following existing pattern)

**AI Prompt for extraction:**

```typescript
const prompt = `Extract the city and state from this PadSplit call.

CONTEXT: PadSplit operates in these major markets: Atlanta GA, Houston TX, Dallas TX, Tampa FL, Charlotte NC, Raleigh NC, Phoenix AZ, Las Vegas NV, Denver CO, Nashville TN, Birmingham AL, Memphis TN, Jacksonville FL, Orlando FL, Miami FL, San Antonio TX.

CALL SUMMARY:
${callSummary}

PROPERTY ADDRESS MENTIONED:
${propertyAddress || 'Not specified'}

Return JSON (no markdown):
{
  "city": "city name or null",
  "state": "two-letter state code or null"
}`;
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/transcribe-call/index.ts` | Modify | Add marketCity/marketState to AI prompt, auto-update empty markets |
| `supabase/functions/backfill-markets-from-transcriptions/index.ts` | Create | Batch process existing transcriptions to extract market data |
| `src/types/index.ts` | Modify | Add marketCity/marketState to MemberDetails interface |

---

## Estimated Impact

| Records | Status | Action |
|---------|--------|--------|
| 105 | Transcribed, no market | Will be backfilled by new function |
| 657 | Transcribed, has market | No action needed |
| 5,058 | Not transcribed, no market | Will get market on future transcription |

---

## Cost Estimate

**Backfill (105 existing records):**
- Using `gemini-2.5-flash-lite` for lightweight extraction
- ~500 tokens per call = $0.0001 per record
- Total: ~$0.01 for all 105 records

**Future (per transcription):**
- Already included in existing AI analysis prompt (no additional cost)
- Auto-enrichment is just a database update

---

## Execution Steps

1. Update `transcribe-call` with new prompt fields and auto-enrichment logic
2. Create `backfill-markets-from-transcriptions` edge function
3. Deploy and run the backfill function to process 105 existing records
4. Verify markets are being populated for new transcriptions
