
-- Step 1: Reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';

-- Step 2: Re-trigger the 5 stuck bookings via pg_net
-- Reset transcription_status to NULL first (in case any are in a bad state)
-- They're already NULL so just re-invoke check-auto-transcription for each

SELECT net.http_post(
  url := 'https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1/check-auto-transcription',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{"bookingId": "bc4354ef-5ca0-4da5-9711-ef3dd7a09757"}'::jsonb
) AS req1;

SELECT net.http_post(
  url := 'https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1/check-auto-transcription',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{"bookingId": "015908f2-a4dc-4a9f-a1ae-0c7664158681"}'::jsonb
) AS req2;

SELECT net.http_post(
  url := 'https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1/check-auto-transcription',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{"bookingId": "6147573b-7510-41d4-a9d5-26731f72655c"}'::jsonb
) AS req3;

SELECT net.http_post(
  url := 'https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1/check-auto-transcription',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{"bookingId": "d8203b74-e101-439f-9604-4e5f5cdad812"}'::jsonb
) AS req4;

SELECT net.http_post(
  url := 'https://qwddqoyewtozzdvfmavn.supabase.co/functions/v1/check-auto-transcription',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{"bookingId": "b4fbf950-2880-49b3-881a-2c3fd38aa92d"}'::jsonb
) AS req5;
