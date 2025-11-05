-- Remove category column from transactions table
ALTER TABLE transactions DROP COLUMN IF EXISTS category;

