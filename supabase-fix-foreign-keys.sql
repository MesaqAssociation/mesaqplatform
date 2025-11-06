-- Fix foreign key constraints to allow member deletion
-- This updates the system_settings table to handle deleted users gracefully

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE system_settings 
DROP CONSTRAINT IF EXISTS system_settings_updated_by_fkey;

-- Step 2: Add the foreign key constraint with ON DELETE SET NULL
-- This means when a user is deleted, the updated_by field will be set to NULL
ALTER TABLE system_settings
ADD CONSTRAINT system_settings_updated_by_fkey 
FOREIGN KEY (updated_by) 
REFERENCES users(id) 
ON DELETE SET NULL;

-- Step 3: Also check and fix other tables that might reference users
-- Update audit_logs to SET NULL on delete
ALTER TABLE audit_logs 
DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;

ALTER TABLE audit_logs
ADD CONSTRAINT audit_logs_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES users(id) 
ON DELETE SET NULL;

-- Update transactions created_by to SET NULL on delete
ALTER TABLE transactions 
DROP CONSTRAINT IF EXISTS transactions_created_by_fkey;

ALTER TABLE transactions
ADD CONSTRAINT transactions_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES users(id) 
ON DELETE SET NULL;

-- Update membership_payments to CASCADE delete (delete payments when user is deleted)
ALTER TABLE membership_payments 
DROP CONSTRAINT IF EXISTS membership_payments_user_id_fkey;

ALTER TABLE membership_payments
ADD CONSTRAINT membership_payments_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES users(id) 
ON DELETE CASCADE;

-- Update member_events to CASCADE delete (delete event associations when user is deleted)
ALTER TABLE member_events 
DROP CONSTRAINT IF EXISTS member_events_user_id_fkey;

ALTER TABLE member_events
ADD CONSTRAINT member_events_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES users(id) 
ON DELETE CASCADE;

-- Verify the changes
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    kcu.column_name,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc 
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name IN ('user_id', 'updated_by', 'created_by')
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

