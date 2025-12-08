-- Seed default global auto-transcription rule if none exists
INSERT INTO transcription_auto_rules (rule_type, auto_transcribe, auto_coaching, priority, is_active)
SELECT 'global', true, true, 0, true
WHERE NOT EXISTS (
    SELECT 1 FROM transcription_auto_rules WHERE rule_type = 'global'
);