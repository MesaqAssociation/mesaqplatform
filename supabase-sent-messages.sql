-- Sent Messages Table for tracking all outgoing SMS messages
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS sent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Message details
  message_type VARCHAR(50) NOT NULL, -- 'payment_reminder', 'event_notification', 'scheduled', 'admin_message'
  template_id VARCHAR(100),
  message_content TEXT, -- The actual message content/summary
  
  -- Recipient info
  recipient_phone VARCHAR(50) NOT NULL,
  recipient_name VARCHAR(255),
  recipient_member_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'sent', -- 'pending', 'sent', 'delivered', 'read', 'failed'
  external_message_id VARCHAR(100), -- Unique ID from SMS provider for status tracking
  error_message TEXT,
  
  -- Metadata
  sent_by TEXT REFERENCES users(id) ON DELETE SET NULL, -- Who triggered the send (null for cron)
  batch_id UUID, -- Group messages sent together
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sent_messages_created_at ON sent_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sent_messages_status ON sent_messages(status);
CREATE INDEX IF NOT EXISTS idx_sent_messages_type ON sent_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_sent_messages_recipient ON sent_messages(recipient_member_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_batch ON sent_messages(batch_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_external_id ON sent_messages(external_message_id);

-- Add comment
COMMENT ON TABLE sent_messages IS 'Tracks all outgoing SMS messages sent via Mobile Message';

