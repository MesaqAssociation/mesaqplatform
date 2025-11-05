-- Add member_id column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS member_id SERIAL UNIQUE;

-- Create a sequence for member IDs if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS users_member_id_seq;

-- Update existing users to have unique member IDs
DO $$
DECLARE
  user_record RECORD;
  next_id INTEGER := 1;
BEGIN
  FOR user_record IN 
    SELECT id FROM users WHERE member_id IS NULL ORDER BY created_at ASC
  LOOP
    UPDATE users SET member_id = next_id WHERE id = user_record.id;
    next_id := next_id + 1;
  END LOOP;
  
  -- Set the sequence to continue from the last assigned ID
  PERFORM setval('users_member_id_seq', next_id - 1);
END $$;

-- Make member_id NOT NULL after populating existing records
ALTER TABLE users ALTER COLUMN member_id SET NOT NULL;
ALTER TABLE users ALTER COLUMN member_id SET DEFAULT nextval('users_member_id_seq');

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_member_id ON users(member_id);

