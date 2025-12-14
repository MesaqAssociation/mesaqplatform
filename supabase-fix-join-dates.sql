-- Set all members' date_joined to 2025-05-01
-- This ensures consistent calculation of past months owed

UPDATE users
SET date_joined = '2025-05-01 13:00:00+00'
WHERE date_joined IS NULL OR date_joined != '2025-05-01 13:00:00+00';

-- Make date_joined NOT NULL with default
ALTER TABLE users
ALTER COLUMN date_joined SET DEFAULT '2025-05-01 13:00:00+00',
ALTER COLUMN date_joined SET NOT NULL;

-- Verify the changes
SELECT id, name, date_joined FROM users ORDER BY name;
