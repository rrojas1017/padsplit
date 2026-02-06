-- Enable realtime for api_costs table to support live cost monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE public.api_costs;