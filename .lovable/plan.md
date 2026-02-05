
# Add Non-Booking Call to LLM Comparison Test

## Current Situation

The LLM Comparison Panel currently:
- Shows only 5 eligible bookings
- Doesn't filter by booking status
- Doesn't show status badges to identify Non-Booking calls

**Kenneth Pickett** (10:33, Non-Booking) is available for comparison but likely hidden in the current UI.

## Solution

Enhance the LLM Comparison Panel to specifically surface Non-Booking calls for testing the readiness detection issue we discovered with Tiffany Andrews.

## Implementation

### Changes to LLMComparisonPanel.tsx

1. **Add a "Non-Booking Test" section** at the top of eligible bookings
   - Query specifically for Non-Booking calls with completed transcriptions
   - Display with a red "Non Booking" badge for visibility
   - Limit to 3 calls for focused testing

2. **Add status badges** to all eligible bookings
   - Show booking status (Pending Move-In, Non Booking, etc.)
   - Color-code Non-Booking calls in red for quick identification

3. **Increase eligible bookings limit** from 5 to 10
   - Ensures more diverse call types are visible

4. **Add comparison result status indicator**
   - Show if the comparison was for a Non-Booking call
   - Display the detected readiness level for quick quality checks

### UI Updates

```text
┌─────────────────────────────────────────────────────┐
│  Non-Booking Calls for Testing (Readiness Check)    │
├─────────────────────────────────────────────────────┤
│  🔴 Kenneth Pickett     10:33  Jan 22  [Compare]    │
│  🔴 Joana Monteiro      12:26  Jan 22  [Compare]    │
│  🔴 Contact Automation   8:54  Jan 23  [Compare]    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Other Eligible Calls                                │
├─────────────────────────────────────────────────────┤
│  🟢 New Booking 1       15:23  Jan 24  [Compare]    │
│  🟢 New Booking 2        8:45  Jan 24  [Compare]    │
└─────────────────────────────────────────────────────┘
```

### Code Changes Summary

| Location | Change |
|----------|--------|
| `fetchEligibleBookings()` | Split into two queries: Non-Booking and regular bookings |
| Eligible bookings render | Add status badge, separate sections |
| Comparison history | Show booking status and detected readiness level |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/ai-management/LLMComparisonPanel.tsx` | Add Non-Booking section, status badges, readiness display |

## Testing

After implementation:
1. Navigate to Settings → AI Management → LLM Quality Comparison
2. See Kenneth Pickett in the "Non-Booking Calls for Testing" section
3. Run comparison to verify DeepSeek's readiness detection accuracy
4. Compare Gemini vs DeepSeek's `moveInReadiness` field in results
