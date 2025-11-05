-- Create membership_payments table to track monthly membership payments
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

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_membership_payments_user ON membership_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_membership_payments_month ON membership_payments(payment_month);
CREATE INDEX IF NOT EXISTS idx_membership_payments_status ON membership_payments(status);

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

-- View to show payment status for all members
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

