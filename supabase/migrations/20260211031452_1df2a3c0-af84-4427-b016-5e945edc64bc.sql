
-- Create market intelligence cache table
CREATE TABLE public.market_intelligence_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text UNIQUE NOT NULL,
  state_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  city_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  filters jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.market_intelligence_cache ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read cache
CREATE POLICY "Authenticated users can read market intelligence cache"
ON public.market_intelligence_cache
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow service role to insert/update (edge function uses service role)
CREATE POLICY "Service role can manage market intelligence cache"
ON public.market_intelligence_cache
FOR ALL
USING (true)
WITH CHECK (true);
