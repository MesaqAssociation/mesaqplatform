-- ============================================================================
-- DATABASE CLEANUP SCRIPT
-- Removes duplicate columns and null columns
-- ============================================================================

-- STEP 1: Copy data from 'phone_number' to 'phone' if phone is null
-- ============================================================================
-- The app uses 'phone' column, so we keep that and remove 'phone_number'
UPDATE users
SET phone = phone_number
WHERE phone IS NULL AND phone_number IS NOT NULL;

-- STEP 2: Drop the duplicate 'phone_number' column (keep original 'phone')
-- ============================================================================
ALTER TABLE users
DROP COLUMN IF EXISTS phone_number;

-- STEP 3: Drop the null 'password' column (keep 'password_hash')
-- ============================================================================
ALTER TABLE users
DROP COLUMN IF EXISTS password;

-- STEP 4: Update the view to use 'phone' instead of 'phone_number'
-- ============================================================================
CREATE OR REPLACE VIEW current_month_payment_status AS
SELECT 
  u.id as user_id,
  u.member_id,
  u.name,
  u.phone as phone_number,  -- Alias phone as phone_number for compatibility
  u.role,
  u.date_joined,
  CASE
    -- Board members and Head Board Member don't pay
    WHEN u.role IN ('Board Member', 'Head Board Member') THEN 'EXEMPT'
    -- Not joined yet or joined after current month
    WHEN u.date_joined IS NULL OR u.date_joined > DATE_TRUNC('month', CURRENT_DATE)::DATE THEN 'N/A'
    -- Check if payment exists for current month
    WHEN EXISTS (
      SELECT 1 FROM membership_payments mp
      WHERE mp.user_id = u.id 
      AND mp.payment_month = DATE_TRUNC('month', CURRENT_DATE)::DATE
      AND mp.status = 'paid'
    ) THEN 'PAID'
    -- Check if we're past the last day of current month
    WHEN CURRENT_DATE > (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE THEN 'OVERDUE'
    -- Otherwise unpaid but still within grace period
    ELSE 'UNPAID'
  END as payment_status,
  -- Get the payment date if exists
  (
    SELECT mp.payment_date 
    FROM membership_payments mp
    WHERE mp.user_id = u.id 
    AND mp.payment_month = DATE_TRUNC('month', CURRENT_DATE)::DATE
    LIMIT 1
  ) as payment_date
FROM users u;

-- STEP 5: Update the extract_phone_number function description
-- ============================================================================
COMMENT ON FUNCTION extract_phone_number(TEXT) IS 
'Extracts Australian mobile phone number (04XXXXXXXX) from text. Used for payment detection.';

-- ============================================================================
-- CLEANUP COMPLETE
-- ============================================================================
-- Summary:
-- - Removed duplicate 'phone_number' column (kept 'phone')
-- - Removed null 'password' column (kept 'password_hash')
-- - Updated view to use 'phone' column
-- ============================================================================

