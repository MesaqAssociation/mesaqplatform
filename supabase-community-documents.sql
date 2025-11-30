-- Create community_documents table for shared documents
CREATE TABLE IF NOT EXISTS community_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_community_documents_uploaded_at ON community_documents(uploaded_at DESC);

-- Add comment
COMMENT ON TABLE community_documents IS 'Shared community documents that all members can view';

-- Verify
SELECT 
  id,
  title,
  description,
  file_name,
  uploaded_at
FROM community_documents
ORDER BY uploaded_at DESC;

