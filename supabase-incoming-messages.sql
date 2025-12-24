-- Create table for storing incoming WhatsApp messages from Picky Assist webhook
CREATE TABLE IF NOT EXISTS incoming_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id VARCHAR(50),
  from_phone VARCHAR(50) NOT NULL,
  to_phone VARCHAR(50),
  message_type VARCHAR(50) DEFAULT 'text',
  message_text TEXT,
  contact_name VARCHAR(255),
  contact_phone VARCHAR(50),
  timestamp TIMESTAMPTZ NOT NULL,
  raw_payload JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_incoming_messages_timestamp ON incoming_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_incoming_messages_from_phone ON incoming_messages(from_phone);
CREATE INDEX IF NOT EXISTS idx_incoming_messages_read ON incoming_messages(read);

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL ON incoming_messages TO authenticated;

