-- Update payment status view to show amount paid instead of just PAID/UNPAID
-- Status will be: "$40.00" (amount paid), "UNPAID", or "REVIEW"

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
    -- Check if payment exists for current month with PAID status - show TOTAL amount
    WHEN EXISTS (
      SELECT 1 FROM membership_payments mp
      WHERE mp.user_id = u.id 
      AND mp.payment_month = DATE_TRUNC('month', CURRENT_DATE)::DATE
      AND mp.status = 'paid'
    ) THEN (
      SELECT '$' || CAST(SUM(mp.amount) AS TEXT)
      FROM membership_payments mp
      WHERE mp.user_id = u.id 
      AND mp.payment_month = DATE_TRUNC('month', CURRENT_DATE)::DATE
      AND mp.status = 'paid'
    )
    -- Everyone else is UNPAID
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
'Shows payment status for current month. Status values: $XX.XX (TOTAL amount paid for the month), UNPAID, REVIEW (ambiguous match). All members must pay by last day of month.';

-- Verify the changes
SELECT 
  name,
  role,
  payment_status,
  payment_date
FROM current_month_payment_status
ORDER BY name
LIMIT 10;

