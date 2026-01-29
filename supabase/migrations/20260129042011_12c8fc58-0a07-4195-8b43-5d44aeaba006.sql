-- Drop the existing constraint
ALTER TABLE bookings 
DROP CONSTRAINT IF EXISTS bookings_status_check;

-- Add updated constraint with "Non Booking" included
ALTER TABLE bookings 
ADD CONSTRAINT bookings_status_check 
CHECK (status IN ('Pending Move-In', 'Moved In', 'Member Rejected', 'No Show', 'Cancelled', 'Non Booking'));