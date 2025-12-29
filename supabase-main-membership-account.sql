-- Add is_main_membership_account flag to financial_accounts
-- Only ONE account can be the main membership payment account
-- This account's BSB and account number are used in payment reminder messages

ALTER TABLE financial_accounts 
ADD COLUMN IF NOT EXISTS is_main_membership_account BOOLEAN DEFAULT FALSE;

-- Create a unique partial index to ensure only one account can be the main membership account
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_accounts_main_membership 
ON financial_accounts (is_main_membership_account) 
WHERE is_main_membership_account = TRUE;

COMMENT ON COLUMN financial_accounts.is_main_membership_account IS 'If true, this account is the main membership payment account. Its BSB and account number are used in payment reminder messages. Only one account can have this flag set to true.';

-- If no account is marked as main, set the first non-donation account as main
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM financial_accounts WHERE is_main_membership_account = TRUE) THEN
    UPDATE financial_accounts 
    SET is_main_membership_account = TRUE 
    WHERE id = (
      SELECT id FROM financial_accounts 
      WHERE is_donation_account = FALSE 
      ORDER BY created_at ASC 
      LIMIT 1
    );
  END IF;
END $$;

