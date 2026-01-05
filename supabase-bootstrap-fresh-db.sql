-- ============================================================================
-- MESAQ ASSOCIATION - FRESH DATABASE BOOTSTRAP
-- ============================================================================
-- Run this ENTIRE file in Supabase SQL Editor to set up a brand new database.
-- This creates all required tables, indexes, and default data.
-- ============================================================================

-- ============================================================================
-- 1. CORE TABLES
-- ============================================================================

-- System settings (must be first - no dependencies)
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- Insert default system settings
INSERT INTO system_settings (key, value) VALUES 
  ('monthly_membership_fee', '40.00'),
  ('late_payment_fines_enabled', 'false'),
  ('late_payment_fine_amount', '10.00'),
  ('whatsapp_reminders_enabled', 'true'),
  ('whatsapp_board_group_id', '')
ON CONFLICT (key) DO NOTHING;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT,
  email TEXT,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  address TEXT,
  image TEXT,
  role TEXT DEFAULT 'Community Member',
  member_id TEXT,
  banking_name TEXT,
  group_name TEXT,
  group_id UUID,
  is_group_leader BOOLEAN DEFAULT FALSE,
  household_members INTEGER DEFAULT 1,
  date_joined DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);
CREATE INDEX IF NOT EXISTS idx_users_group ON users(group_name);

-- ============================================================================
-- 2. EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  address TEXT,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  event_type TEXT DEFAULT 'Event',
  organizing_group TEXT,
  organizing_group_id UUID,
  estimated_cost DECIMAL(10, 2),
  agenda JSONB,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);

-- Member events (attendance tracking)
CREATE TABLE IF NOT EXISTS member_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  attended BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_member_events_user ON member_events(user_id);
CREATE INDEX IF NOT EXISTS idx_member_events_event ON member_events(event_id);

-- ============================================================================
-- 3. FINANCE
-- ============================================================================

-- Financial accounts
CREATE TABLE IF NOT EXISTS financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name TEXT NOT NULL DEFAULT 'Main Account',
  account_number TEXT,
  bsb TEXT,
  current_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  currency TEXT DEFAULT 'AUD',
  is_donation_account BOOLEAN DEFAULT FALSE,
  is_main_membership_account BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one main membership account
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_accounts_main_membership 
ON financial_accounts (is_main_membership_account) 
WHERE is_main_membership_account = TRUE;

-- Bank statements
CREATE TABLE IF NOT EXISTS bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES financial_accounts(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT DEFAULT 'application/pdf',
  file_url TEXT,
  statement_date_from DATE,
  statement_date_to DATE,
  transaction_count INTEGER DEFAULT 0,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_statements_account ON bank_statements(account_id);
CREATE INDEX IF NOT EXISTS idx_bank_statements_dates ON bank_statements(statement_date_from, statement_date_to);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES financial_accounts(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  transaction_name TEXT,
  description TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  transaction_type TEXT CHECK (transaction_type IN ('debit', 'credit', 'adjustment')),
  category TEXT,
  reference TEXT,
  balance_after DECIMAL(15, 2),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'manual',
  matched_member_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  statement_id UUID REFERENCES bank_statements(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_matched_member ON transactions(matched_member_id);
CREATE INDEX IF NOT EXISTS idx_transactions_statement ON transactions(statement_id);

-- Payment keywords
CREATE TABLE IF NOT EXISTS payment_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL UNIQUE,
  payment_type TEXT NOT NULL DEFAULT 'Special Payment',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. MEMBERSHIP PAYMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS membership_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  payment_month DATE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  payment_date DATE NOT NULL,
  status TEXT DEFAULT 'paid',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, payment_month)
);

CREATE INDEX IF NOT EXISTS idx_membership_payments_user ON membership_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_membership_payments_month ON membership_payments(payment_month);
CREATE INDEX IF NOT EXISTS idx_membership_payments_status ON membership_payments(status);

-- Payment reminders tracking
CREATE TABLE IF NOT EXISTS payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  payment_month DATE NOT NULL,
  reminder_stage INTEGER NOT NULL DEFAULT 1,
  last_reminder_date DATE,
  fine_applied BOOLEAN DEFAULT FALSE,
  fine_amount DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_reminders_user ON payment_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_month ON payment_reminders(payment_month);

-- ============================================================================
-- 5. GROUPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS member_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for group_id in users (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_group_id_fkey'
  ) THEN
    ALTER TABLE users 
    ADD CONSTRAINT users_group_id_fkey 
    FOREIGN KEY (group_id) REFERENCES member_groups(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore if constraint already exists
END $$;

-- ============================================================================
-- 6. NOTIFICATIONS & MESSAGING
-- ============================================================================

-- Scheduled notifications
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  recipients_count INTEGER DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_date ON scheduled_notifications(scheduled_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notifications_status ON scheduled_notifications(status);

-- Incoming WhatsApp messages
CREATE TABLE IF NOT EXISTS incoming_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id VARCHAR(50),
  from_phone VARCHAR(50) NOT NULL,
  to_phone VARCHAR(50),
  message_type VARCHAR(50) DEFAULT 'text',
  message_text TEXT,
  media_url TEXT,
  contact_name VARCHAR(255),
  contact_phone VARCHAR(50),
  timestamp TIMESTAMPTZ NOT NULL,
  raw_payload JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incoming_messages_timestamp ON incoming_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_incoming_messages_from_phone ON incoming_messages(from_phone);
CREATE INDEX IF NOT EXISTS idx_incoming_messages_read ON incoming_messages(read);

-- ============================================================================
-- 7. DOCUMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_documents_uploaded_at ON community_documents(uploaded_at DESC);

-- ============================================================================
-- 8. DEFAULT DATA
-- ============================================================================

-- Insert default financial account if none exists
INSERT INTO financial_accounts (account_name, current_balance, is_main_membership_account)
SELECT 'Main Account', 0.00, TRUE
WHERE NOT EXISTS (SELECT 1 FROM financial_accounts);

-- ============================================================================
-- BOOTSTRAP COMPLETE!
-- ============================================================================
-- Your database is now ready for Mesaq.
-- 
-- Next steps:
-- 1. Create your first admin user by signing up through the app
-- 2. Update their role to 'Board' or 'Manager' in the users table:
--    UPDATE users SET role = 'Board' WHERE phone = 'your_phone_number';
-- 3. Configure environment variables in Vercel
-- 4. Redeploy the application
-- ============================================================================

SELECT 'Mesaq database bootstrap complete!' AS status;

