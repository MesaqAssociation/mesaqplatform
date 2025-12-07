-- Create payment_keywords table for automatic classification
-- Keywords in descriptions will trigger automatic payment type classification

CREATE TABLE IF NOT EXISTS payment_keywords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  keyword TEXT NOT NULL UNIQUE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('Special Payment', 'Membership Payment')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT REFERENCES users(id)
);

-- Create index for fast keyword lookups
CREATE INDEX IF NOT EXISTS idx_payment_keywords_keyword ON payment_keywords(keyword);

-- Insert some default keywords
INSERT INTO payment_keywords (keyword, payment_type) VALUES
  ('meal', 'Special Payment'),
  ('event', 'Special Payment'),
  ('donation', 'Special Payment'),
  ('fundraiser', 'Special Payment'),
  ('membership', 'Membership Payment'),
  ('monthly', 'Membership Payment')
ON CONFLICT (keyword) DO NOTHING;

-- Show current keywords
SELECT keyword, payment_type, created_at FROM payment_keywords ORDER BY payment_type, keyword;

