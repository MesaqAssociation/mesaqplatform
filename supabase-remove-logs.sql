-- Remove audit_logs system completely
-- This script removes the audit_logs table and related functionality

-- Drop the audit_logs table
DROP TABLE IF EXISTS audit_logs CASCADE;

-- Note: If there are any triggers or functions related to audit_logs,
-- they should also be removed. Add those statements here if needed.

COMMENT ON SCHEMA public IS 'Removed audit_logs table - no longer tracking system logs';

