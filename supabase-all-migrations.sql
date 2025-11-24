-- ============================================================================
-- MESAQ ASSOCIATION - ALL SQL MIGRATIONS
-- Run this entire file in Supabase SQL Editor to set up all features
-- ============================================================================

-- ============================================================================
-- 1. MATCHED MEMBER COLUMN FOR TRANSACTIONS
-- ============================================================================
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS matched_member_id TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_matched_member ON transactions(matched_member_id);

COMMENT ON COLUMN transactions.matched_member_id IS 'References the member (user) this transaction is matched to. Used for tracking member payments and categorization.';

-- ============================================================================
-- 2. PAYMENT REMINDERS SYSTEM
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  payment_month DATE NOT NULL,
  reminder_stage INTEGER NOT NULL DEFAULT 1, -- 1 = first, 2 = second, 3 = final
  last_reminder_date DATE,
  fine_applied BOOLEAN DEFAULT FALSE,
  fine_amount DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_reminders_user ON payment_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_month ON payment_reminders(payment_month);

COMMENT ON TABLE payment_reminders IS 'Tracks automated payment reminder stages for members who have not paid';
COMMENT ON COLUMN payment_reminders.reminder_stage IS '1 = first reminder (day 7), 2 = second reminder (day 14), 3 = final/fine (next month day 7)';

-- System settings for payment reminders and fines
INSERT INTO system_settings (key, value)
VALUES 
  ('late_payment_fines_enabled', 'false'),
  ('late_payment_fine_amount', '10.00'),
  ('whatsapp_reminders_enabled', 'true'),
  ('whatsapp_board_group_id', '')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 3. DONATION ACCOUNTS FLAG
-- ============================================================================
ALTER TABLE financial_accounts
ADD COLUMN IF NOT EXISTS is_donation_account BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN financial_accounts.is_donation_account IS 'If true, this account is for donations and transactions should not be matched to members.';

-- ============================================================================
-- 4. BANK STATEMENTS STORAGE
-- ============================================================================
CREATE TABLE IF NOT EXISTS bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT REFERENCES financial_accounts(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT DEFAULT 'application/pdf',
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if they don't exist (in case table was created earlier)
ALTER TABLE bank_statements 
ADD COLUMN IF NOT EXISTS statement_date_from DATE;

ALTER TABLE bank_statements 
ADD COLUMN IF NOT EXISTS statement_date_to DATE;

ALTER TABLE bank_statements 
ADD COLUMN IF NOT EXISTS transaction_count INTEGER DEFAULT 0;

-- Indexes for bank statements
CREATE INDEX IF NOT EXISTS idx_bank_statements_account ON bank_statements(account_id);
CREATE INDEX IF NOT EXISTS idx_bank_statements_dates ON bank_statements(statement_date_from, statement_date_to);
CREATE INDEX IF NOT EXISTS idx_bank_statements_uploaded ON bank_statements(uploaded_at DESC);

-- Add statement reference to transactions
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS statement_id UUID REFERENCES bank_statements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_statement ON transactions(statement_id);

COMMENT ON TABLE bank_statements IS 'Stores uploaded bank statement files and metadata';
COMMENT ON COLUMN bank_statements.statement_date_from IS 'Start date of transactions in the statement';
COMMENT ON COLUMN bank_statements.statement_date_to IS 'End date of transactions in the statement';
COMMENT ON COLUMN bank_statements.transaction_count IS 'Number of transactions in this statement';
COMMENT ON COLUMN transactions.statement_id IS 'Reference to the bank statement this transaction came from';

-- ============================================================================
-- VERIFICATION QUERIES (Optional - Run these to check)
-- ============================================================================

-- Check if all columns were added
-- SELECT 
--   column_name, 
--   data_type, 
--   is_nullable
-- FROM information_schema.columns
-- WHERE table_name IN ('transactions', 'financial_accounts', 'payment_reminders', 'bank_statements')
-- ORDER BY table_name, ordinal_position;

-- Check if all indexes were created
-- SELECT 
--   tablename,
--   indexname,
--   indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename IN ('transactions', 'financial_accounts', 'payment_reminders', 'bank_statements')
-- ORDER BY tablename, indexname;

-- ============================================================================
-- MIGRATION COMPLETE!
-- ============================================================================
-- All tables and columns have been added successfully.
-- You can now use all the new features:
-- ✅ Transaction matching to members
-- ✅ Payment reminder system
-- ✅ Donation account tracking
-- ✅ Bank statement storage and linking
-- ============================================================================

