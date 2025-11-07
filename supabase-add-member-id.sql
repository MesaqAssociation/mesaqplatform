-- Add member_id integer field to users table
-- This is a unique integer identifier for each member

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS member_id INTEGER UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_member_id ON users(member_id);

-- Add comment
COMMENT ON COLUMN users.member_id IS 'Unique integer identifier for member (e.g., 1, 2, 3). Used for matching transactions.';

-- Verify
SELECT 
  id,
  name,
  member_id,
  phone,
  banking_name
FROM users
ORDER BY created_at
LIMIT 10;

