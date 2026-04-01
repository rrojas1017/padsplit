
-- Add campaign_key column to research_campaigns
ALTER TABLE research_campaigns ADD COLUMN IF NOT EXISTS campaign_key TEXT UNIQUE;

-- Backfill existing rows: convert name to dash-separated slug
UPDATE research_campaigns
SET campaign_key = REPLACE(TRIM(name), ' ', '-')
WHERE campaign_key IS NULL;

-- Make campaign_key NOT NULL after backfill
ALTER TABLE research_campaigns ALTER COLUMN campaign_key SET NOT NULL;
