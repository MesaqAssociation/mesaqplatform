-- Update payment_keywords table to support new payment categories
-- Categories: 'Membership Payment', 'Event Payment', 'Donation'
-- 'Special Payment' is kept for backwards compatibility but should be treated as 'Event Payment'

-- First, drop the existing constraint
ALTER TABLE payment_keywords 
DROP CONSTRAINT IF EXISTS payment_keywords_payment_type_check;

-- Add new constraint with updated categories
ALTER TABLE payment_keywords 
ADD CONSTRAINT payment_keywords_payment_type_check 
CHECK (payment_type IN ('Membership Payment', 'Event Payment', 'Donation', 'Special Payment'));

-- Update existing 'Special Payment' keywords that contain 'donation' in the keyword to be 'Donation'
UPDATE payment_keywords 
SET payment_type = 'Donation' 
WHERE payment_type = 'Special Payment' 
  AND LOWER(keyword) LIKE '%donat%';

-- Update remaining 'Special Payment' keywords to 'Event Payment'
-- (Optional - you may want to keep them as 'Special Payment' for backwards compatibility)
-- UPDATE payment_keywords 
-- SET payment_type = 'Event Payment' 
-- WHERE payment_type = 'Special Payment';

-- Insert some default donation keywords if they don't exist
INSERT INTO payment_keywords (keyword, payment_type) VALUES
  ('donation', 'Donation'),
  ('donate', 'Donation'),
  ('charity', 'Donation'),
  ('gift', 'Donation'),
  ('zakat', 'Donation'),
  ('sadaqah', 'Donation')
ON CONFLICT (keyword) DO UPDATE SET payment_type = EXCLUDED.payment_type;

-- Update event-related keywords to be 'Event Payment'
UPDATE payment_keywords 
SET payment_type = 'Event Payment' 
WHERE keyword IN ('meal', 'event', 'fundraiser', 'dinner', 'lunch', 'iftar', 'eid')
  AND payment_type = 'Special Payment';

-- Show current keywords after update
SELECT keyword, payment_type, created_at FROM payment_keywords ORDER BY payment_type, keyword;

