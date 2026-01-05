-- Add media_url column to incoming_messages table for storing image/file attachments
ALTER TABLE incoming_messages 
ADD COLUMN IF NOT EXISTS media_url TEXT;

-- Add index for filtering by message type
CREATE INDEX IF NOT EXISTS idx_incoming_messages_type ON incoming_messages(message_type);

COMMENT ON COLUMN incoming_messages.media_url IS 'URL to media file (image, audio, video, document) from Picky Assist CDN';

