-- Add contact email and phone columns to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS contact_email text,
ADD COLUMN IF NOT EXISTS contact_phone text;