-- Make file_url nullable in bank_statements table
-- This allows statements to be uploaded even when R2 storage is not configured

ALTER TABLE bank_statements 
ALTER COLUMN file_url DROP NOT NULL;

-- Verify the change
SELECT 
  column_name, 
  is_nullable, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'bank_statements' 
  AND column_name = 'file_url';

 