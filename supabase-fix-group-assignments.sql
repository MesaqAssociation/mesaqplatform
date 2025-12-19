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

-- 4. Note: Your database uses the legacy system (group_name only)
-- The new system uses group_id + member_groups table
-- To upgrade, you would need to:
-- 1. Create member_groups table
-- 2. Add group_id column to users
-- 3. Migrate data
-- For now, just use group_name assignments above

-- 5. Verify the fix (legacy system - group_name only)
SELECT 
  u.name,
  u.group_name,
  COALESCE(u.is_group_leader, false) as is_group_leader
FROM users u
WHERE u.group_name IS NOT NULL
ORDER BY u.group_name, u.is_group_leader DESC NULLS LAST, u.name;

