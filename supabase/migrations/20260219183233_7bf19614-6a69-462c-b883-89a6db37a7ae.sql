ALTER TABLE public.script_access_tokens
  ALTER COLUMN token SET DEFAULT replace(replace(replace(
    encode(gen_random_uuid()::text::bytea, 'base64'),
    '+', '-'), '/', '_'), E'\n', '');