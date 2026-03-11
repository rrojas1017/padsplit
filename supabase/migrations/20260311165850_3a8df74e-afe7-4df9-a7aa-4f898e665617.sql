
-- Fix string arrays in completed aggregate reports
-- Step 1: Fix operational_blind_spots (only where it's actually an array)
UPDATE research_insights
SET data = jsonb_set(data, '{operational_blind_spots}',
  COALESCE((SELECT jsonb_agg(
    CASE WHEN jsonb_typeof(elem) = 'string' THEN jsonb_build_object('blind_spot', elem) ELSE elem END
  ) FROM jsonb_array_elements(data->'operational_blind_spots') AS elem), '[]'::jsonb))
WHERE status = 'completed' AND insight_type = 'aggregate'
  AND jsonb_typeof(data->'operational_blind_spots') = 'array';

-- Step 2: Fix host_accountability_flags
UPDATE research_insights
SET data = jsonb_set(data, '{host_accountability_flags}',
  COALESCE((SELECT jsonb_agg(
    CASE WHEN jsonb_typeof(elem) = 'string' THEN jsonb_build_object('flag', elem) ELSE elem END
  ) FROM jsonb_array_elements(data->'host_accountability_flags') AS elem), '[]'::jsonb))
WHERE status = 'completed' AND insight_type = 'aggregate'
  AND jsonb_typeof(data->'host_accountability_flags') = 'array';

-- Step 3: Fix emerging_patterns
UPDATE research_insights
SET data = jsonb_set(data, '{emerging_patterns}',
  COALESCE((SELECT jsonb_agg(
    CASE WHEN jsonb_typeof(elem) = 'string' THEN jsonb_build_object('pattern', elem) ELSE elem END
  ) FROM jsonb_array_elements(data->'emerging_patterns') AS elem), '[]'::jsonb))
WHERE status = 'completed' AND insight_type = 'aggregate'
  AND jsonb_typeof(data->'emerging_patterns') = 'array';

-- Step 4: Fix executive_summary if string
UPDATE research_insights
SET data = jsonb_set(data, '{executive_summary}',
  jsonb_build_object('headline', data->>'executive_summary', 'total_cases', COALESCE(total_records_analyzed, 0)))
WHERE status = 'completed' AND insight_type = 'aggregate'
  AND jsonb_typeof(data->'executive_summary') = 'string';

-- Step 5: Fix reason_code_distribution if object (not array)
UPDATE research_insights
SET data = jsonb_set(data, '{reason_code_distribution}',
  COALESCE((SELECT jsonb_agg(
    jsonb_build_object('code', kv.key, 'reason_group', kv.key, 'count',
      CASE WHEN kv.value ~ '^\d+$' THEN kv.value::int ELSE 0 END, 'pct', 0)
  ) FROM jsonb_each_text(data->'reason_code_distribution') AS kv), '[]'::jsonb))
WHERE status = 'completed' AND insight_type = 'aggregate'
  AND jsonb_typeof(data->'reason_code_distribution') = 'object';
