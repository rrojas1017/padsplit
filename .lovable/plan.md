
# Fix: Budget Data Not Showing in Market Intelligence — RESOLVED

## Root Cause
The `.in("booking_id", chunk)` query was using chunk size 500, which with 36-char UUIDs exceeded PostgREST's URL length limit, causing the transcription fetch to silently return 0 rows. This meant ALL transcription-derived data (sentiments, buyer intent, budgets, objections) was missing.

## Fix Applied
Reduced transcription fetch chunk size from 500 to 100 UUIDs per query in `aggregate-market-data` edge function, keeping the URL well within limits.

## Verified
- Atlanta: avgWeeklyBudget $214, buyerIntent 70, sentiments populated
- Houston: avgWeeklyBudget $210, buyerIntent 70
- All transcription-derived fields now working correctly
