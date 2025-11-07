-- Allow multiple membership payments per month for the same user
-- This enables members to make multiple payments that sum up to the monthly fee

-- Drop the unique constraint on (user_id, payment_month)
ALTER TABLE membership_payments 
DROP CONSTRAINT IF EXISTS membership_payments_user_id_payment_month_key;

-- Add a unique constraint on transaction_id instead (one payment per transaction)
ALTER TABLE membership_payments 
ADD CONSTRAINT membership_payments_transaction_id_key UNIQUE (transaction_id);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_membership_payments_user_month 
ON membership_payments(user_id, payment_month);

COMMENT ON TABLE membership_payments IS 
'Membership payment records. Multiple payments per month are allowed and will be summed in the payment_status view.';

-- Verify
SELECT 
  user_id,
  payment_month,
  COUNT(*) as payment_count,
  SUM(amount) as total_amount
FROM membership_payments
GROUP BY user_id, payment_month
HAVING COUNT(*) > 1
ORDER BY payment_month DESC
LIMIT 10;

