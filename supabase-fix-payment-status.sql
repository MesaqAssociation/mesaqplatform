-- Fix payment status to show UNPAID by default and calculate based on current month only
-- Everyone must pay by the last day of the month, regardless of when they joined

-- Drop and recreate the current_month_payment_status view
DROP VIEW IF EXISTS current_month_payment_status;

CREATE VIEW current_month_payment_status AS
SELECT 
  u.id as user_id,
  u.member_id,
  u.name,
  u.phone as phone_number,
  u.role,
  u.date_joined,
  CASE
    -- Check if payment exists for current month with REVIEW status
    WHEN EXISTS (
      SELECT 1 FROM membership_payments mp
      WHERE mp.user_id = u.id 
      AND mp.payment_month = DATE_TRUNC('month', CURRENT_DATE)::DATE
      AND mp.status = 'review'
    ) THEN 'REVIEW'
    -- Check if payment exists for current month with PAID status
    WHEN EXISTS (
      SELECT 1 FROM membership_payments mp
      WHERE mp.user_id = u.id 
      AND mp.payment_month = DATE_TRUNC('month', CURRENT_DATE)::DATE
      AND mp.status = 'paid'
    ) THEN 'PAID'
    -- Everyone else is UNPAID (no overdue status, just unpaid)
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
'Shows payment status for current month only. All members must pay by the last day of the month. Status values: PAID, UNPAID, REVIEW (ambiguous match). No date_joined checks - everyone pays regardless of join date.';

-- Verify the changes
SELECT 
  name,
  role,
  date_joined,
  payment_status
FROM current_month_payment_status
ORDER BY name
LIMIT 10;

