-- Add new columns to users table if they don't exist
-- Note: password_hash should already exist from the initial setup
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Community Member';
ALTER TABLE users ADD COLUMN IF NOT EXISTS banking_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_joined DATE;

-- Create events table for tracking member event attendance
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  event_type TEXT DEFAULT 'Event',
  estimated_cost DECIMAL(10, 2),
  email_attendees BOOLEAN DEFAULT false,
  attendees JSONB DEFAULT '[]'::jsonb,
  agenda JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if table already exists
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(10, 2);
ALTER TABLE events ADD COLUMN IF NOT EXISTS email_attendees BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS attendees JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS agenda JSONB DEFAULT '[]'::jsonb;

-- Update event_date column type if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' 
    AND column_name = 'event_date' 
    AND data_type = 'timestamp with time zone'
  ) THEN
    ALTER TABLE events ALTER COLUMN event_date TYPE DATE USING event_date::date;
  END IF;
END $$;

-- Create member_events junction table for tracking attendance
CREATE TABLE IF NOT EXISTS member_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  attended BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_member_events_user ON member_events(user_id);
CREATE INDEX IF NOT EXISTS idx_member_events_event ON member_events(event_id);

