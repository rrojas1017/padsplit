-- Drop the existing foreign key constraint
ALTER TABLE public.access_logs DROP CONSTRAINT IF EXISTS access_logs_user_id_fkey;

-- Re-add the constraint with ON DELETE SET NULL
ALTER TABLE public.access_logs 
ADD CONSTRAINT access_logs_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;