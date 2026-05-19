ALTER TABLE public.api_credentials
ADD COLUMN IF NOT EXISTS client_secret_salt TEXT;