INSERT INTO public.research_campaigns (name, script_id, status, target_count, campaign_key, assigned_researchers, start_date)
SELECT '30-Day Member Experience', 'c24c5e6b-c7d8-43c6-86d5-affea47178bf'::uuid, 'active', 2000, '30-Day-Member-Experience',
  (SELECT assigned_researchers FROM public.research_campaigns WHERE campaign_key = 'Payments-Research-Campaign' LIMIT 1),
  CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM public.research_campaigns WHERE campaign_key = '30-Day-Member-Experience');

INSERT INTO public.research_campaigns (name, script_id, status, target_count, campaign_key, assigned_researchers, start_date)
SELECT 'Non-Booking Conversion Research', '827b23ef-3f35-4108-8462-468bf6cf7872'::uuid, 'active', 2000, 'Non-Booking-Conversion-Research',
  (SELECT assigned_researchers FROM public.research_campaigns WHERE campaign_key = 'Payments-Research-Campaign' LIMIT 1),
  CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM public.research_campaigns WHERE campaign_key = 'Non-Booking-Conversion-Research');

INSERT INTO public.script_access_tokens (script_id, label)
SELECT 'c24c5e6b-c7d8-43c6-86d5-affea47178bf'::uuid, 'External Link'
WHERE NOT EXISTS (SELECT 1 FROM public.script_access_tokens WHERE script_id = 'c24c5e6b-c7d8-43c6-86d5-affea47178bf'::uuid AND is_active);

INSERT INTO public.script_access_tokens (script_id, label)
SELECT '827b23ef-3f35-4108-8462-468bf6cf7872'::uuid, 'External Link'
WHERE NOT EXISTS (SELECT 1 FROM public.script_access_tokens WHERE script_id = '827b23ef-3f35-4108-8462-468bf6cf7872'::uuid AND is_active);