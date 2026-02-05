-- Add columns to track prompt enhancement usage in LLM comparisons
ALTER TABLE llm_quality_comparisons
ADD COLUMN IF NOT EXISTS deepseek_prompt_enhanced boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS deepseek_enhancements_used text;