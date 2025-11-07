-- Add transaction_name column to transactions table
-- This separates the first line (name) from subsequent lines (description)

-- Add the new column
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS transaction_name TEXT;

-- For existing transactions, copy description to transaction_name
UPDATE transactions 
SET transaction_name = description 
WHERE transaction_name IS NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN transactions.transaction_name IS 'First line from bank statement - the transaction name/title';
COMMENT ON COLUMN transactions.description IS 'Additional lines from bank statement - detailed description';

-- Verify the changes
SELECT 
  id,
  transaction_date,
  transaction_name,
  description,
  amount
FROM transactions
ORDER BY transaction_date DESC
LIMIT 5;

