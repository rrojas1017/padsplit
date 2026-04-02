

# Add Video Testimonial Column to Research Reports

## What changes
Add a "Video" column to the research reports table showing whether a caller accepted the video testimonial option. The data lives in `booking_transcriptions.research_extraction` → `video_testimonial.interested_in_recording`.

## Technical approach

### 1. `src/hooks/useReportsData.ts`
- Add `research_extraction` to the `booking_transcriptions(...)` select clause
- Extract `video_testimonial.interested_in_recording` and map it to a new `videoTestimonialInterest` field on the Booking record

### 2. `src/types/index.ts`
- Add `videoTestimonialInterest?: boolean | null` to the `Booking` type

### 3. `src/pages/Reports.tsx`
- Add a "Video" column header in the research table (after Campaign or Progress)
- Display a green check icon (✓) if `true`, red X if `false`, dash if `null`/undefined
- Show only for audience survey rows (move-out survey rows show "—" since they don't have this question)
- Add "Video Interest" to the CSV export

### Files
| File | Action |
|------|--------|
| `src/types/index.ts` | Add `videoTestimonialInterest` to Booking |
| `src/hooks/useReportsData.ts` | Select `research_extraction`, extract video testimonial field |
| `src/pages/Reports.tsx` | Add Video column header, cell rendering, CSV export |

