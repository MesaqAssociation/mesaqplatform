-- SQL Script: Remove trailing '0' from phone numbers
-- Run this in Supabase SQL Editor or via psql

-- First, preview the changes (dry run)
-- This shows which phone numbers would be affected
SELECT 
    id,
    name,
    phone AS old_phone,
    CASE 
        WHEN phone LIKE '%0' THEN LEFT(phone, LENGTH(phone) - 1)
        ELSE phone
    END AS new_phone,
    CASE 
        WHEN phone LIKE '%0' THEN 'WILL CHANGE'
        ELSE 'NO CHANGE'
    END AS status
FROM users
WHERE phone IS NOT NULL AND phone != ''
ORDER BY name;

-- Count how many will be affected
SELECT 
    COUNT(*) AS total_with_phone,
    COUNT(*) FILTER (WHERE phone LIKE '%0') AS ending_with_zero
FROM users
WHERE phone IS NOT NULL AND phone != '';

-- ============================================
-- UNCOMMENT THE BELOW TO APPLY THE CHANGES
-- ============================================

-- UPDATE users
-- SET phone = LEFT(phone, LENGTH(phone) - 1)
-- WHERE phone IS NOT NULL 
--   AND phone != '' 
--   AND phone LIKE '%0';

-- Verify the changes
-- SELECT id, name, phone FROM users WHERE phone IS NOT NULL AND phone != '' ORDER BY name;

