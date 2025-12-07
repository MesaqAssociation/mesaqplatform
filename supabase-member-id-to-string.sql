-- Change member_id from integer to string to support A01, A02, etc. format
-- Run this script in your Supabase SQL editor

-- Step 1: Add a new column for string member_id
ALTER TABLE users ADD COLUMN IF NOT EXISTS member_id_string TEXT;

-- Step 2: Migrate existing data (convert integers to A01, A02 format)
UPDATE users 
SET member_id_string = 'A' || LPAD(member_id::text, 2, '0')
WHERE member_id IS NOT NULL;

-- Step 3: Drop the old integer column
ALTER TABLE users DROP COLUMN IF EXISTS member_id;

-- Step 4: Rename the new column to member_id
ALTER TABLE users RENAME COLUMN member_id_string TO member_id;

-- Step 5: Add unique constraint
ALTER TABLE users ADD CONSTRAINT users_member_id_unique UNIQUE (member_id);

-- Step 6: Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_member_id ON users(member_id);

-- Verify the changes
SELECT member_id, name, email FROM users ORDER BY member_id LIMIT 10;

