-- Change detected_issues from text[] to jsonb to support rich issue objects
-- This allows storing { issue, matchingKeywords, matchingConcerns } per issue
ALTER TABLE public.bookings 
  ALTER COLUMN detected_issues TYPE jsonb 
  USING CASE 
    WHEN detected_issues IS NOT NULL THEN to_jsonb(detected_issues)
    ELSE NULL
  END;