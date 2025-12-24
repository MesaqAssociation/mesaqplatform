-- Fix blank/null transaction categories
-- This script will set all transactions with blank or null categories to 'Event Payment'
-- and update membership-related transactions appropriately

-- First, let's see what we have
SELECT 
  category, 
  COUNT(*) as count,
  transaction_type
FROM transactions 
GROUP BY category, transaction_type
ORDER BY category;

-- Update all blank/null categories to 'Event Payment' for credit transactions
UPDATE transactions 
SET category = 'Event Payment' 
WHERE (category IS NULL OR category = '' OR TRIM(category) = '')
  AND transaction_type = 'credit';

-- Update debit transactions to 'Expense'
UPDATE transactions 
SET category = 'Expense' 
WHERE (category IS NULL OR category = '' OR TRIM(category) = '')
  AND transaction_type = 'debit';

-- Verify the fix
SELECT 
  category, 
  COUNT(*) as count,
  transaction_type
FROM transactions 
GROUP BY category, transaction_type
ORDER BY category;

