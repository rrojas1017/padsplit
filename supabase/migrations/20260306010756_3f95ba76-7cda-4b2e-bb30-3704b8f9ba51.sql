ALTER TABLE research_insights DROP CONSTRAINT research_insights_insight_type_check;
ALTER TABLE research_insights ADD CONSTRAINT research_insights_insight_type_check 
  CHECK (insight_type = ANY (ARRAY['nps','sentiment','themes','competitors','features','recommendations','summary','aggregate']));