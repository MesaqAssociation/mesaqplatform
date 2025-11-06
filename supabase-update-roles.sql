-- Update roles: Change "Head Board Member" to "Manager" and add new officer roles
-- Run this script in Supabase SQL Editor

-- Step 1: Update existing "Head Board Member" to "Manager"
UPDATE users 
SET role = 'Manager' 
WHERE role = 'Head Board Member';

-- Step 2: Verify the update
SELECT role, COUNT(*) as count 
FROM users 
GROUP BY role 
ORDER BY role;

-- Note: The new roles are:
-- - Manager (formerly Head Board Member)
-- - Board Member (unchanged)
-- - Community Member (unchanged)
-- - Public Officer (new)
-- - Finance Officer (new)
-- - Logistics Officer (new)

-- No schema changes needed - the role column already accepts any text value

