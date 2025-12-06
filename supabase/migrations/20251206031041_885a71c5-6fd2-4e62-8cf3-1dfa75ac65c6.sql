-- Create storage bucket for coaching audio
INSERT INTO storage.buckets (id, name, public) 
VALUES ('coaching-audio', 'coaching-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read coaching audio
CREATE POLICY "Authenticated users can view coaching audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'coaching-audio' AND auth.uid() IS NOT NULL);

-- Allow service role to upload coaching audio (edge functions)
CREATE POLICY "Service role can manage coaching audio"
ON storage.objects FOR ALL
USING (bucket_id = 'coaching-audio')
WITH CHECK (bucket_id = 'coaching-audio');