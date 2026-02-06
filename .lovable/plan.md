

# Plan: Flag Bookings Without Real Conversations

## Problem Statement
Agents are creating bookings linked to calls that are only voicemails or failed connections - no actual conversation took place. The AI correctly identifies this in the call summary, but admins have no visibility into these problematic records.

**Example:** Jeanette Arroyo (10 second call) - The "conversation" is just a voicemail greeting: *"Your call has been forwarded to voicemail..."*

---

## Solution Overview

Create an automated detection and flagging system that:
1. Identifies calls without real conversations during transcription
2. Stores a validation flag in the database
3. Displays visual warnings in the Reports table
4. Provides a filter to find all flagged records

---

## Implementation Steps

### Step 1: Database Schema Update
Add a new column to track conversation validity:

```sql
-- Add conversation validation column
ALTER TABLE bookings 
ADD COLUMN has_valid_conversation boolean DEFAULT NULL;

-- Add index for filtering
CREATE INDEX idx_bookings_valid_conversation 
ON bookings(has_valid_conversation) 
WHERE has_valid_conversation = false;
```

### Step 2: AI Detection During Transcription
Modify the `transcribe-call` edge function to detect invalid conversations:

**Detection Criteria:**
- Call duration under 30 seconds
- Transcription contains voicemail indicators: "forwarded to voicemail", "leave a message", "not available"  
- AI summary contains: "no actual conversation", "voicemail", "no discussion"
- Only one speaker detected (monologue)

**Store the result:**
```typescript
// After AI analysis, add validation check
const hasValidConversation = validateConversation({
  durationSeconds: callDurationSeconds,
  transcription: rawTranscription,
  summary: callSummary,
  speakerCount: words.filter(w => w.speaker_id).length
});

// Update booking with validation flag
await supabase
  .from('bookings')
  .update({ has_valid_conversation: hasValidConversation })
  .eq('id', bookingId);
```

### Step 3: Visual Warning in Reports Table
Add a warning badge next to bookings flagged as "no conversation":

**Location:** Contact name column in Reports page

**Visual Design:**
- Orange/amber warning icon with tooltip
- Tooltip shows: "No real conversation detected - this call was a voicemail or failed connection"

### Step 4: Add Filter Option
Add a new filter dropdown in Reports:

**Options:**
- All Records (default)
- Verified Conversations Only
- No Conversation Flagged

### Step 5: Backfill Existing Records
Create a one-time backfill for existing transcribed bookings:

**Criteria for flagging:**
1. `call_duration_seconds < 30` AND transcription status = 'completed'
2. `call_summary` contains: "voicemail", "no actual conversation", "no discussion"

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/migrations/` | New migration for `has_valid_conversation` column |
| `supabase/functions/transcribe-call/index.ts` | Add conversation validation logic |
| `src/pages/Reports.tsx` | Add warning badge and filter dropdown |
| `src/hooks/useReportsData.ts` | Include `has_valid_conversation` in query |
| `src/types/index.ts` | Add `hasValidConversation?: boolean` to Booking type |

---

## Technical Details

### Conversation Validation Function
```typescript
function validateConversation(params: {
  durationSeconds: number | null;
  transcription: string;
  summary: string;
}): boolean {
  const { durationSeconds, transcription, summary } = params;
  const lowerTranscription = transcription.toLowerCase();
  const lowerSummary = summary.toLowerCase();
  
  // Short call duration is suspicious
  if (durationSeconds && durationSeconds < 30) {
    // Check for voicemail indicators
    const voicemailIndicators = [
      'forwarded to voicemail',
      'leave your message',
      'leave a message',
      'not available',
      'at the tone',
      'please record your message',
      'mailbox is full'
    ];
    
    if (voicemailIndicators.some(i => lowerTranscription.includes(i))) {
      return false;
    }
  }
  
  // AI detected no conversation
  const noConversationIndicators = [
    'no actual conversation',
    'voicemail recording',
    'no discussion',
    'no conversation took place',
    'no contact was made'
  ];
  
  if (noConversationIndicators.some(i => lowerSummary.includes(i))) {
    return false;
  }
  
  return true;
}
```

### Warning Badge Component
```tsx
{booking.hasValidConversation === false && (
  <Tooltip content="No real conversation detected - voicemail or failed connection">
    <AlertTriangle className="h-4 w-4 text-amber-500" />
  </Tooltip>
)}
```

---

## Expected Outcome

After implementation:
- **11 existing bookings** this month will be automatically flagged
- Future voicemail/failed calls will be flagged in real-time
- Admins can filter Reports to see all flagged records
- Visual warning prevents suspicious bookings from going unnoticed

