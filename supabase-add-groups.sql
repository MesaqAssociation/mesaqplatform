-- Add group field to users table for rotating event organization

-- Add group column to users table (nullable for existing users)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS group_name VARCHAR(50);

-- Add organizing_group column to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS organizing_group VARCHAR(50);

-- Update system_settings to track last organizing group
INSERT INTO system_settings (key, value)
VALUES ('last_organizing_group', '')
ON CONFLICT (key) DO NOTHING;

-- Optional: Set some example groups for existing users (you can customize these)
-- UPDATE users SET group_name = 'Group A' WHERE member_id BETWEEN '1' AND '10';
-- UPDATE users SET group_name = 'Group B' WHERE member_id BETWEEN '11' AND '20';
-- UPDATE users SET group_name = 'Group C' WHERE member_id BETWEEN '21' AND '30';

-- Comments for documentation
-- group_name: The group this member belongs to for rotating event organization duties
-- organizing_group: The group responsible for organizing this event
