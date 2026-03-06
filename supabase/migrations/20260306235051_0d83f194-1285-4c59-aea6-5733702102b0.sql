INSERT INTO public.research_prompts (prompt_key, prompt_text, temperature, model, version)
SELECT 'merged', '', 0.2, 'google/gemini-2.5-flash', 1
WHERE NOT EXISTS (SELECT 1 FROM public.research_prompts WHERE prompt_key = 'merged');