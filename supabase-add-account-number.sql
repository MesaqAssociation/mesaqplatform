-- Add account_number field to financial_accounts table
-- This will store the 14-digit bank account number for matching statements

ALTER TABLE financial_accounts 
ADD COLUMN IF NOT EXISTS account_number TEXT UNIQUE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_financial_accounts_number ON financial_accounts(account_number);

-- Add comment
COMMENT ON COLUMN financial_accounts.account_number IS '14-digit bank account number for matching uploaded statements';

-- Verify
SELECT 
  id,
  account_name,
  account_number,
  current_balance
FROM financial_accounts
ORDER BY created_at;

