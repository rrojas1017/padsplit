-- Add device and context tracking columns to display_token_views
ALTER TABLE public.display_token_views 
ADD COLUMN device_type text,
ADD COLUMN operating_system text,
ADD COLUMN browser text,
ADD COLUMN screen_width integer,
ADD COLUMN screen_height integer,
ADD COLUMN referrer text,
ADD COLUMN language text,
ADD COLUMN timezone text;