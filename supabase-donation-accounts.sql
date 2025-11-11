-- Add is_donation_account flag to financial_accounts
-- Donation accounts are for viewing only, no member detection or payment processing

ALTER TABLE financial_accounts 
ADD COLUMN IF NOT EXISTS is_donation_account BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_financial_accounts_donation ON financial_accounts(is_donation_account);

COMMENT ON COLUMN financial_accounts.is_donation_account IS 'If true, transactions in this account will not be matched to members or processed for payments. For viewing donations only.';

