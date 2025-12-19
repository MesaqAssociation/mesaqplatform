-- Remove attendees and email_attendees columns from events table
-- These fields are no longer needed

ALTER TABLE events DROP COLUMN IF EXISTS attendees;
ALTER TABLE events DROP COLUMN IF EXISTS email_attendees;

