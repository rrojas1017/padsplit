-- Drop existing constraint that only allows elevenlabs and lovable_ai
ALTER TABLE api_costs DROP CONSTRAINT IF EXISTS api_costs_service_provider_check;

-- Add updated constraint with deepgram included
ALTER TABLE api_costs ADD CONSTRAINT api_costs_service_provider_check 
CHECK (service_provider = ANY (ARRAY['elevenlabs', 'lovable_ai', 'deepgram']));