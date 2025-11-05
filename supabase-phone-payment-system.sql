-- Add phone number column to users if not exists
ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Create index for phone number lookups
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);

-- Add monthly_fee to users table (can be overridden per user if needed)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS custom_monthly_fee DECIMAL(10, 2);

-- Create settings table for system-wide settings
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT REFERENCES users(id)
);

-- Insert default monthly fee if not exists
INSERT INTO system_settings (key, value)
VALUES ('monthly_membership_fee', '50.00')
ON CONFLICT (key) DO NOTHING;

-- Create current_month_payment_status view
-- This shows PAID/UNPAID status for the current month only
CREATE OR REPLACE VIEW current_month_payment_status AS
SELECT 
  u.id as user_id,
  u.member_id,
  u.name,
  u.phone_number,
  u.role,
  u.date_joined,
  CASE
    -- Board members and Head Board Member don't pay
    WHEN u.role IN ('Board Member', 'Head Board Member') THEN 'EXEMPT'
    -- Not joined yet or joined after current month
    WHEN u.date_joined IS NULL OR u.date_joined > DATE_TRUNC('month', CURRENT_DATE)::DATE THEN 'N/A'
    -- Check if payment exists for current month
    WHEN EXISTS (
      SELECT 1 FROM membership_payments mp
      WHERE mp.user_id = u.id 
      AND mp.payment_month = DATE_TRUNC('month', CURRENT_DATE)::DATE
      AND mp.status = 'paid'
    ) THEN 'PAID'
    -- Check if we're past the last day of current month
    WHEN CURRENT_DATE > (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE THEN 'OVERDUE'
    -- Otherwise unpaid but still within grace period
    ELSE 'UNPAID'
  END as payment_status,
  -- Get the payment date if exists
  (
    SELECT mp.payment_date 
    FROM membership_payments mp
    WHERE mp.user_id = u.id 
    AND mp.payment_month = DATE_TRUNC('month', CURRENT_DATE)::DATE
    LIMIT 1
  ) as payment_date
FROM users u;

-- Function to reset payment statuses at start of new month
-- This should be called via a cron job or manually on the 1st of each month
CREATE OR REPLACE FUNCTION reset_monthly_payment_status()
RETURNS void AS $$
BEGIN
  -- This function doesn't delete old records, just ensures new month starts fresh
  -- Old payment records remain in membership_payments for history
  -- The view automatically shows current month status
  
  -- Log the reset
  INSERT INTO audit_logs (user_id, action, entity_type, details)
  VALUES (
    (SELECT id FROM users WHERE role = 'Head Board Member' LIMIT 1),
    'reset_monthly_payments',
    'system',
    json_build_object('month', DATE_TRUNC('month', CURRENT_DATE))
  );
END;
$$ LANGUAGE plpgsql;

-- Function to extract phone numbers from text
CREATE OR REPLACE FUNCTION extract_phone_number(text_input TEXT)
RETURNS TEXT AS $$
DECLARE
  phone_match TEXT;
BEGIN
  -- Match Australian mobile format: 04XX XXX XXX or 04XXXXXXXX
  phone_match := (regexp_matches(text_input, '(04\d{8})', 'g'))[1];
  
  IF phone_match IS NULL THEN
    -- Try with spaces: 04XX XXX XXX
    phone_match := regexp_replace(
      (regexp_matches(text_input, '(04\d{2}\s?\d{3}\s?\d{3})', 'g'))[1],
      '\s', '', 'g'
    );
  END IF;
  
  RETURN phone_match;
END;
$$ LANGUAGE plpgsql;

-- Create index on transactions description for faster phone searches
CREATE INDEX IF NOT EXISTS idx_transactions_description_phone 
ON transactions USING gin (to_tsvector('english', description));

COMMENT ON VIEW current_month_payment_status IS 
'Shows payment status for current month only. Status values: PAID, UNPAID, OVERDUE, EXEMPT (board members), N/A (not joined yet)';

