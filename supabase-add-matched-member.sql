-- Add matched_member_id column to transactions table to track which member a transaction belongs to
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS matched_member_id TEXT REFERENCES users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_matched_member ON transactions(matched_member_id);

-- Add comment
COMMENT ON COLUMN transactions.matched_member_id IS 'References the member (user) this transaction is matched to. Used for tracking member payments and categorization.';

