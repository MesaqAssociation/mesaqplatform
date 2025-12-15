-- Remove meetings table from the database
-- Run this script in your Supabase SQL editor

-- Drop the meetings table if it exists
DROP TABLE IF EXISTS meetings CASCADE;

-- Remove any meeting-related audit logs (optional - clean up)
DELETE FROM audit_logs WHERE action LIKE '%meeting%';

-- Verify deletion
SELECT 'Meetings table removed successfully' AS status;
