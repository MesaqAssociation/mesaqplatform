-- Create payment_reminders table to track reminder state for unpaid members
CREATE TABLE IF NOT EXISTS payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  payment_month DATE NOT NULL,
  reminder_stage INTEGER NOT NULL DEFAULT 1, -- 1 = first reminder, 2 = second reminder, 3 = fine/final
  last_reminder_date DATE,
  fine_applied BOOLEAN DEFAULT FALSE,
  fine_amount DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, payment_month)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payment_reminders_user ON payment_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_month ON payment_reminders(payment_month);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_stage ON payment_reminders(reminder_stage);

-- Add fine settings to system_settings
INSERT INTO system_settings (key, value, description)
VALUES 
  ('late_payment_fines_enabled', 'false', 'Enable fines for late payments'),
  ('late_payment_fine_amount', '10.00', 'Fine amount for late payments (AUD)')
ON CONFLICT (key) DO NOTHING;

-- Add WhatsApp settings
INSERT INTO system_settings (key, value, description)
VALUES 
  ('whatsapp_reminders_enabled', 'true', 'Enable WhatsApp payment reminders'),
  ('whatsapp_board_group_id', '', 'WhatsApp group ID for board notifications')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE payment_reminders IS 'Tracks payment reminder state for members with unpaid fees';
COMMENT ON COLUMN payment_reminders.reminder_stage IS '1=first reminder (7th), 2=second reminder (14th), 3=fine/final (next month 7th)';

