-- Add 'voice_note' to the allowed communication types
ALTER TABLE public.contact_communications 
DROP CONSTRAINT IF EXISTS contact_communications_communication_type_check;

ALTER TABLE public.contact_communications 
ADD CONSTRAINT contact_communications_communication_type_check 
CHECK (communication_type IN ('sms', 'email', 'voice_note'));