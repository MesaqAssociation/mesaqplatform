-- ============================================================================
-- COMPLETE PAYMENT SYSTEM MIGRATION
-- Run this file in Supabase SQL Editor
-- ============================================================================

-- STEP 1: Create membership_payments table (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS membership_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  payment_month DATE NOT NULL, -- First day of the month this payment covers
  amount DECIMAL(10, 2) NOT NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  payment_date DATE NOT NULL,
  status TEXT DEFAULT 'paid', -- 'paid', 'pending', 'overdue'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, payment_month)
);

-- Create indexes for membership_payments
CREATE INDEX IF NOT EXISTS idx_membership_payments_user ON membership_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_membership_payments_month ON membership_payments(payment_month);
CREATE INDEX IF NOT EXISTS idx_membership_payments_status ON membership_payments(status);


-- STEP 2: Add phone number and custom fee columns to users
-- ============================================================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone_number TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS custom_monthly_fee DECIMAL(10, 2);

-- Create index for phone number lookups
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);


-- STEP 3: Create system_settings table
-- ============================================================================
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


-- STEP 4: Create current_month_payment_status view
-- ============================================================================
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

COMMENT ON VIEW current_month_payment_status IS 
'Shows payment status for current month only. Status values: PAID, UNPAID, OVERDUE, EXEMPT (board members), N/A (not joined yet)';


-- STEP 5: Create member_payment_status view (historical)
-- ============================================================================
CREATE OR REPLACE VIEW member_payment_status AS
SELECT 
  u.id as user_id,
  u.member_id,
  u.name,
  u.banking_name,
  u.date_joined,
  COUNT(DISTINCT expected_months.month) as expected_payments,
  COUNT(DISTINCT mp.payment_month) as paid_payments,
  COUNT(DISTINCT expected_months.month) - COUNT(DISTINCT mp.payment_month) as missing_payments,
  ARRAY_AGG(DISTINCT expected_months.month ORDER BY expected_months.month) 
    FILTER (WHERE mp.payment_month IS NULL) as unpaid_months
FROM users u
CROSS JOIN LATERAL (
  SELECT generate_series(
    DATE_TRUNC('month', u.date_joined),
    DATE_TRUNC('month', CURRENT_DATE),
    '1 month'::interval
  )::DATE as month
) expected_months
LEFT JOIN membership_payments mp ON u.id = mp.user_id AND mp.payment_month = expected_months.month
WHERE u.date_joined IS NOT NULL
GROUP BY u.id, u.member_id, u.name, u.banking_name, u.date_joined;


-- STEP 6: Create utility functions
-- ============================================================================

-- Function to get expected payment months for a user
CREATE OR REPLACE FUNCTION get_expected_payment_months(
  p_user_id TEXT,
  p_date_joined DATE,
  p_current_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(payment_month DATE) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE_TRUNC('month', d)::DATE as payment_month
  FROM generate_series(
    DATE_TRUNC('month', p_date_joined)::DATE,
    DATE_TRUNC('month', p_current_date)::DATE,
    '1 month'::interval
  ) d;
END;
$$ LANGUAGE plpgsql;

-- Function to reset payment statuses at start of new month
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


-- STEP 7: Create indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_description_phone 
ON transactions USING gin (to_tsvector('english', description));


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Add phone numbers to member profiles
-- 2. Set monthly fee in settings (Head Board Member)
-- 3. Upload bank statements to auto-detect payments
-- 4. View payment status on members table
-- ============================================================================

