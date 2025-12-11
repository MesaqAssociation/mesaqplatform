-- Cleanup script to remove membership_payments records that are linked to Special Payment transactions
-- This fixes the issue where special payments were being counted toward member balances

-- First, let's see what we're about to delete (optional, run this first to review)
-- SELECT 
--   mp.id,
--   mp.user_id,
--   u.name as member_name,
--   mp.payment_month,
--   mp.amount,
--   t.category,
--   t.description
-- FROM membership_payments mp
-- JOIN transactions t ON mp.transaction_id = t.id
-- JOIN users u ON mp.user_id = u.id
-- WHERE t.category = 'Special Payment';

-- Now delete the incorrect records
DELETE FROM membership_payments
WHERE transaction_id IN (
  SELECT mp.transaction_id
  FROM membership_payments mp
  JOIN transactions t ON mp.transaction_id = t.id
  WHERE t.category = 'Special Payment'
);

-- Show how many records were deleted
-- You can run: SELECT changes() to see the count in SQLite
-- Or just check the result of the DELETE statement
