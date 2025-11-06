-- Remove payment exemption for board members
-- Everyone must pay their monthly membership fee

-- Update current_month_payment_status view to remove EXEMPT status
CREATE OR REPLACE VIEW current_month_payment_status AS
SELECT 
  u.id as user_id,
  u.member_id,
  u.name,
  u.phone as phone_number,  -- Alias phone as phone_number for compatibility
  u.role,
  u.date_joined,
  CASE
    -- Not joined yet or joined after current month
    WHEN u.date_joined IS NULL OR u.date_joined > DATE_TRUNC('month', CURRENT_DATE)::DATE THEN 'N/A'
    -- Check if payment exists for current month with REVIEW status
    WHEN EXISTS (
      SELECT 1 FROM membership_payments mp
      WHERE mp.user_id = u.id 
      AND mp.payment_month = DATE_TRUNC('month', CURRENT_DATE)::DATE
      AND mp.status = 'review'
    ) THEN 'REVIEW'
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
'Shows payment status for current month only. Status values: PAID, UNPAID, OVERDUE, REVIEW (ambiguous match), N/A (not joined yet). All members must pay.';

