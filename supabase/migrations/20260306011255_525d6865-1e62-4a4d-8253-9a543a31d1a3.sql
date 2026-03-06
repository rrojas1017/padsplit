UPDATE research_insights 
SET status = 'failed', error_message = 'Interrupted by concurrent invocation'
WHERE id IN ('4643c1b8-5019-43a9-8830-87801859c2a4', '4cff2d10-da6b-4685-b9b6-71bb4c7e8450')
AND status = 'processing';