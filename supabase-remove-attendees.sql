-- Remove attendees and email_attendees columns from events table
-- These fields are no longer needed

-- Only run if events table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'events') THEN
    ALTER TABLE events DROP COLUMN IF EXISTS attendees;
    ALTER TABLE events DROP COLUMN IF EXISTS email_attendees;
    RAISE NOTICE 'Removed attendees columns from events table';
  ELSE
    RAISE NOTICE 'Events table does not exist - skipping migration';
  END IF;
END $$;

