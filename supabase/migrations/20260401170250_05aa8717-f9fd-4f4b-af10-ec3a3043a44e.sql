
ALTER TABLE public.booking_transcriptions ADD COLUMN IF NOT EXISTS research_campaign_type text DEFAULT 'move_out_survey';

ALTER TABLE public.research_insights ADD COLUMN IF NOT EXISTS campaign_type text DEFAULT 'move_out_survey';

CREATE INDEX IF NOT EXISTS idx_booking_transcriptions_campaign_type ON public.booking_transcriptions(research_campaign_type);

CREATE INDEX IF NOT EXISTS idx_research_insights_campaign_type ON public.research_insights(campaign_type);

UPDATE public.booking_transcriptions SET research_campaign_type = 'move_out_survey' WHERE research_campaign_type IS NULL AND research_extraction IS NOT NULL;
