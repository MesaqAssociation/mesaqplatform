-- Clear all member_ids and allow NULL values
-- This allows manual entry of member IDs without unique constraint issues

-- Step 1: Drop the unique constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_member_id_unique;

-- Step 2: Clear all existing member_ids
UPDATE users SET member_id = NULL;

-- Step 3: Verify all are cleared
SELECT COUNT(*) as total_members, COUNT(member_id) as members_with_id FROM users;

-- Note: You can now manually set member_ids (A01, A02, B01, etc.)
-- The unique constraint can be re-added later if needed with:
-- ALTER TABLE users ADD CONSTRAINT users_member_id_unique UNIQUE (member_id);

