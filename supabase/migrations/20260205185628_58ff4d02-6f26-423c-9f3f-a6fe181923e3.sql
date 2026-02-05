-- Part 1: Add 'deepseek' to the api_costs service_provider CHECK constraint
ALTER TABLE api_costs 
DROP CONSTRAINT IF EXISTS api_costs_service_provider_check;

ALTER TABLE api_costs 
ADD CONSTRAINT api_costs_service_provider_check 
CHECK (service_provider = ANY (ARRAY['elevenlabs', 'lovable_ai', 'deepgram', 'deepseek']));

-- Part 2: Create failed_downstream_calls tracking table
CREATE TABLE IF NOT EXISTS failed_downstream_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  function_name text NOT NULL,
  status_code integer,
  error_message text,
  attempt_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_failed_downstream_booking ON failed_downstream_calls(booking_id);
CREATE INDEX IF NOT EXISTS idx_failed_downstream_unresolved ON failed_downstream_calls(resolved_at) WHERE resolved_at IS NULL;

-- Enable RLS
ALTER TABLE failed_downstream_calls ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (edge functions use service role)
CREATE POLICY "Service role has full access to failed_downstream_calls"
ON failed_downstream_calls
FOR ALL
USING (true)
WITH CHECK (true);