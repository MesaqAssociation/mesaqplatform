-- Create bank_statements table to store uploaded statement files
CREATE TABLE IF NOT EXISTS bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT REFERENCES financial_accounts(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT DEFAULT 'application/pdf',
  statement_date_from DATE,
  statement_date_to DATE,
  transaction_count INTEGER DEFAULT 0,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bank_statements_account ON bank_statements(account_id);
CREATE INDEX IF NOT EXISTS idx_bank_statements_dates ON bank_statements(statement_date_from, statement_date_to);
CREATE INDEX IF NOT EXISTS idx_bank_statements_uploaded ON bank_statements(uploaded_at DESC);

-- Add statement_id column to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS statement_id UUID REFERENCES bank_statements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_statement ON transactions(statement_id);

COMMENT ON TABLE bank_statements IS 'Stores uploaded bank statement files and metadata';
COMMENT ON COLUMN bank_statements.statement_date_from IS 'Start date of transactions in the statement';
COMMENT ON COLUMN bank_statements.statement_date_to IS 'End date of transactions in the statement';
COMMENT ON COLUMN bank_statements.transaction_count IS 'Number of transactions in this statement';
COMMENT ON COLUMN transactions.statement_id IS 'Reference to the bank statement this transaction came from';

