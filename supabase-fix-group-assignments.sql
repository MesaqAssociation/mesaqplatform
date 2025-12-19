-- Diagnostic and fix script for group assignments

-- 1. Check current group assignments
SELECT 
  COALESCE(group_name, 'No Group') as group_name,
  COUNT(*) as member_count,
  STRING_AGG(name, ', ' ORDER BY name) as members
FROM users
GROUP BY group_name
ORDER BY group_name;

-- 2. Check if member_groups table exists and has data
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'member_groups') THEN
    RAISE NOTICE 'member_groups table exists - checking data...';
    PERFORM * FROM member_groups;
  ELSE
    RAISE NOTICE 'member_groups table does NOT exist - you are using legacy group_name only';
  END IF;
END $$;

-- If member_groups exists, run this query:
-- SELECT 
--   id,
--   name,
--   (SELECT COUNT(*) FROM users WHERE group_id = member_groups.id) as actual_member_count,
--   (SELECT COUNT(*) FROM users WHERE group_name = member_groups.name) as legacy_member_count
-- FROM member_groups
-- ORDER BY name;

-- 3. If you need to reassign members to correct groups:
-- UNCOMMENT AND MODIFY THE LINES BELOW based on your actual group structure

-- Example: Move members from 'Group 01' to proper groups
-- UPDATE users SET group_name = 'Group 02' WHERE name IN ('Member1', 'Member2', 'Member3');
-- UPDATE users SET group_name = 'Group 03' WHERE name IN ('Member4', 'Member5', 'Member6');

-- 4. If you want to use the new group_id system, sync group_name to group_id:
-- First, ensure member_groups table has all your groups
-- Then run this to sync:
/*
UPDATE users u
SET group_id = mg.id
FROM member_groups mg
WHERE u.group_name = mg.name
  AND u.group_id IS NULL;
*/

-- 5. Verify the fix (works without member_groups table)
SELECT 
  u.name,
  u.group_name,
  u.group_id,
  u.is_group_leader
FROM users u
WHERE u.group_name IS NOT NULL
ORDER BY u.group_name, u.is_group_leader DESC NULLS LAST, u.name;

