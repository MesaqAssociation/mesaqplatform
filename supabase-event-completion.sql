-- Add completion columns to events table

ALTER TABLE events
ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completion_summary TEXT,
ADD COLUMN IF NOT EXISTS final_cost DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS completion_files JSONB DEFAULT '[]'::jsonb;

-- Create index for completed events
CREATE INDEX IF NOT EXISTS idx_events_completed ON events(completed);
CREATE INDEX IF NOT EXISTS idx_events_completed_at ON events(completed_at);

