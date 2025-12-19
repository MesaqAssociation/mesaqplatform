-- Simple diagnostic for group assignments
-- Your database has: group_name (text) and is_group_leader (boolean)

-- 1. Show all members and their group assignments
SELECT 
  name,
  group_name,
  COALESCE(is_group_leader, false) as is_leader
FROM users
WHERE group_name IS NOT NULL
ORDER BY group_name, is_group_leader DESC NULLS LAST, name;

-- 2. Count members per group
SELECT 
  group_name,
  COUNT(*) as member_count,
  COUNT(*) FILTER (WHERE is_group_leader = true) as leaders_count
FROM users
WHERE group_name IS NOT NULL
GROUP BY group_name
ORDER BY group_name;

-- 3. Show which members are in each specific group
SELECT 
  group_name,
  STRING_AGG(name || CASE WHEN is_group_leader THEN ' (Leader)' ELSE '' END, ', ' ORDER BY is_group_leader DESC NULLS LAST, name) as members
FROM users
WHERE group_name IS NOT NULL
GROUP BY group_name
ORDER BY group_name;

