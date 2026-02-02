-- Add granular communication permission columns
ALTER TABLE profiles
ADD COLUMN can_send_email boolean NOT NULL DEFAULT false,
ADD COLUMN can_send_sms boolean NOT NULL DEFAULT false,
ADD COLUMN can_send_voice boolean NOT NULL DEFAULT false;

-- Migrate existing permissions to all channels
UPDATE profiles 
SET can_send_email = can_send_communications,
    can_send_sms = can_send_communications,
    can_send_voice = can_send_communications;

COMMENT ON COLUMN profiles.can_send_email IS 'Permission to send emails from contact hover cards';
COMMENT ON COLUMN profiles.can_send_sms IS 'Permission to send SMS from contact hover cards';
COMMENT ON COLUMN profiles.can_send_voice IS 'Permission to initiate voice calls from contact hover cards';