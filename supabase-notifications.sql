-- Create notifications table for scheduled messages
-- Run this script in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  created_by TEXT,  -- Matches users.id which is TEXT type
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  recipients_count INTEGER DEFAULT 0,
  error_message TEXT
);

-- Index for efficient querying of pending notifications
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_date 
ON scheduled_notifications(scheduled_date) 
WHERE status = 'pending';

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_notifications_status 
ON scheduled_notifications(status);

-- Verify creation
SELECT 'Notifications table created successfully' AS status;
