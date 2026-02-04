

## Fix: Edge Function Not Finding Pending Records

### Problem Identified

The `bulk-transcription-processor` edge function has the same filter issue that was already fixed in the frontend:

| Location | Current | Should Be |
|----------|---------|-----------|
| Line 64 (fetch query) | `.eq('transcription_status', 'pending')` | `.is('transcription_status', null)` |
| Line 367 (count query) | `.eq('transcription_status', 'pending')` | `.is('transcription_status', null)` |

This explains why the logs show "No more pending bookings" immediately - the query finds zero records because it's looking for the wrong status value.

### Solution

Update `supabase/functions/bulk-transcription-processor/index.ts`:

**Change 1 - Line 64 (getPendingBookings function):**
```typescript
// Before
.eq('transcription_status', 'pending')

// After  
.is('transcription_status', null)
```

**Change 2 - Line 367 (start/resume action):**
```typescript
// Before
.eq('transcription_status', 'pending')

// After
.is('transcription_status', null)
```

### Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `supabase/functions/bulk-transcription-processor/index.ts` | 64 | Change `.eq()` to `.is()` for null check |
| `supabase/functions/bulk-transcription-processor/index.ts` | 367 | Change `.eq()` to `.is()` for null check |

### After This Fix

When you create a new job and start it:
- The count query will correctly show 394 records for Vixicom
- The processing loop will find and process records
- Each record will go through the full transcription pipeline

