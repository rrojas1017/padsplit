-- Drop the existing foreign key constraint on display_tokens
ALTER TABLE public.display_tokens DROP CONSTRAINT IF EXISTS display_tokens_created_by_fkey;

-- Re-add the constraint with ON DELETE SET NULL
ALTER TABLE public.display_tokens 
ADD CONSTRAINT display_tokens_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;