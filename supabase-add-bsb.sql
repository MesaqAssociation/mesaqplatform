-- Add BSB field to financial_accounts table
-- BSB is a 6-digit bank identifier in Australia (format: XXX-XXX)

ALTER TABLE financial_accounts 
ADD COLUMN IF NOT EXISTS bsb TEXT;

-- Add comment
COMMENT ON COLUMN financial_accounts.bsb IS 'Bank State Branch (BSB) number in format XXX-XXX (e.g., 123-456)';

-- Verify
SELECT 
  id,
  account_name,
  account_number,
  bsb,
  current_balance,
  is_donation_account
FROM financial_accounts
ORDER BY created_at;

