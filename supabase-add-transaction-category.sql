-- Add category column to transactions table
-- Category can be a member name or "Misc"

-- Add the new column
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Misc';

-- Add index for faster category queries
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);

-- Add comment explaining the column
COMMENT ON COLUMN transactions.category IS 'Transaction category: member name if matched by phone/banking name, otherwise "Misc"';

-- Verify the changes
SELECT 
  id,
  transaction_date,
  transaction_name,
  category,
  amount
FROM transactions
ORDER BY transaction_date DESC
LIMIT 5;

