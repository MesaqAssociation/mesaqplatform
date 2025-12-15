-- Add group leader functionality
-- Run this script in your Supabase SQL editor

-- Add is_group_leader column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_group_leader BOOLEAN DEFAULT false;

-- Create index for efficient leader lookups
CREATE INDEX IF NOT EXISTS idx_users_group_leader 
ON users(group_name, is_group_leader) 
WHERE is_group_leader = true;

-- Comment explaining the column
COMMENT ON COLUMN users.is_group_leader IS 'Indicates if this member is the leader of their group. Only one leader per group.';

-- Verify addition
SELECT 'Group leader column added successfully' AS status;
