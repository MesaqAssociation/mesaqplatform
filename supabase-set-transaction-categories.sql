-- Set default categories for all transactions based on amount
-- Run this script in your Supabase SQL editor

-- Get the monthly membership fee from settings
DO $$
DECLARE
    monthly_fee DECIMAL;
BEGIN
    -- Get the monthly fee (default to 40 if not set)
    SELECT COALESCE(CAST(value AS DECIMAL), 40.00) INTO monthly_fee
    FROM system_settings 
    WHERE key = 'monthly_membership_fee';
    
    -- Update all transactions that don't have a category
    -- Membership Payment: exactly matches monthly fee
    -- Special Payment: anything else
    UPDATE transactions
    SET category = CASE
        WHEN ABS(amount) = monthly_fee THEN 'Membership Payment'
        ELSE 'Special Payment'
    END
    WHERE category IS NULL OR category = '';
    
    -- Show results
    RAISE NOTICE 'Updated transactions with default categories based on monthly fee: $%', monthly_fee;
END $$;

-- Verify the results
SELECT 
    category,
    COUNT(*) as count,
    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_credits,
    SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_debits
FROM transactions
GROUP BY category
ORDER BY category;

