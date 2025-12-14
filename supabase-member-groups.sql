-- Create member_groups table for proper group management
CREATE TABLE IF NOT EXISTS member_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migration: Move existing group_name values to the new table
INSERT INTO member_groups (name)
SELECT DISTINCT group_name 
FROM users 
WHERE group_name IS NOT NULL AND group_name != ''
ON CONFLICT (name) DO NOTHING;

-- Add group_id column to users (foreign key to member_groups)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES member_groups(id) ON DELETE SET NULL;

-- Migrate existing group_name values to group_id
UPDATE users u
SET group_id = mg.id
FROM member_groups mg
WHERE u.group_name = mg.name AND u.group_id IS NULL;

-- Now we can drop the old group_name column if desired (optional)
-- ALTER TABLE users DROP COLUMN IF EXISTS group_name;

-- Add organizing_group_id to events (foreign key to member_groups)
ALTER TABLE events
ADD COLUMN IF NOT EXISTS organizing_group_id UUID REFERENCES member_groups(id) ON DELETE SET NULL;

-- Migrate existing organizing_group values to organizing_group_id
UPDATE events e
SET organizing_group_id = mg.id
FROM member_groups mg
WHERE e.organizing_group = mg.name AND e.organizing_group_id IS NULL;
