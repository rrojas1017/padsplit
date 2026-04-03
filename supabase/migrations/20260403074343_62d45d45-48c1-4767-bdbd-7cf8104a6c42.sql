ALTER TABLE research_scripts
  ADD COLUMN IF NOT EXISTS script_type TEXT DEFAULT 'qualitative',
  ADD COLUMN IF NOT EXISTS ai_prompt TEXT,
  ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT 'gemini-2.5-flash',
  ADD COLUMN IF NOT EXISTS ai_temperature NUMERIC(3,2) DEFAULT 0.20,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

UPDATE research_scripts SET slug = campaign_type WHERE slug IS NULL;