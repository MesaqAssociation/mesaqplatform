-- Create payment_keywords table for automatic classification
-- Keywords in descriptions will trigger automatic "Special Payment" classification

CREATE TABLE IF NOT EXISTS payment_keywords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  keyword TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id)
);

-- Create index for fast keyword lookups
CREATE INDEX IF NOT EXISTS idx_payment_keywords_keyword ON payment_keywords(keyword);

-- Insert some default keywords
INSERT INTO payment_keywords (keyword, description) VALUES
  ('meal', 'Payment for meals or food'),
  ('event', 'Payment for special events'),
  ('donation', 'Charitable donation'),
  ('fundraiser', 'Fundraising contribution')
ON CONFLICT (keyword) DO NOTHING;

-- Show current keywords
SELECT * FROM payment_keywords ORDER BY keyword;

