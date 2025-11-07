# Transaction Name & Description Separation

## Overview
Updated the transaction system to properly separate transaction names from descriptions, matching the structure of bank statements where the first line is the transaction name and subsequent lines are detailed descriptions.

## Database Changes

### New Column Added
```sql
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS transaction_name TEXT;
```

### Column Structure
- **`transaction_name`**: First line from bank statement - the transaction name/title
- **`description`**: Additional lines from bank statement - detailed description

### Migration File
Run this SQL script in Supabase SQL Editor:
```
supabase-add-transaction-name.sql
```

This will:
1. Add the `transaction_name` column
2. Copy existing `description` values to `transaction_name` for backward compatibility
3. Add helpful comments to the columns

## How It Works

### PDF Parsing
When a bank statement PDF is uploaded:

1. **Text Extraction**: The parser extracts transaction text from the PDF
2. **Line Splitting**: Transaction text is split into lines
3. **Name Assignment**: First line → `transaction_name`
4. **Description Assignment**: Subsequent lines → `description`

Example:
```
Raw transaction text:
"PayID Transfer from John Smith
04XXXXXXXX
Monthly membership fee"

Results in:
- transaction_name: "PayID Transfer from John Smith"
- description: "04XXXXXXXX Monthly membership fee"
```

### Storage
Both fields are stored in the database:
```sql
INSERT INTO transactions 
  (account_id, transaction_date, transaction_name, description, amount, ...) 
VALUES 
  ($1, $2, $3, $4, $5, ...)
```

## UI Changes

### Finance Page - Transactions Table

**Before:**
| Date | Description | Amount |
|------|-------------|--------|

**After:**
| Date | Name | Description | Amount |
|------|------|-------------|--------|

- **Name column**: Shows the transaction name (bold, prominent)
- **Description column**: Shows additional details (muted, truncated with `max-w-xs`)

### Transaction Detail Dialog
When clicking on a transaction, the popup now shows:
- **Date**: Transaction date
- **Name**: Transaction name (large, bold)
- **Description**: Full description text (only shown if not empty)
- **Type**: Credit/Debit/Adjustment
- **Amount**: Transaction amount
- **Balance After**: Account balance after transaction
- **Reference**: Optional reference number
- **Source**: Where the transaction came from (bank_statement, telegram_bot, manual)
- **Created By**: User who created/imported it
- **Created At**: Timestamp

### Dashboard - Recent Transactions
The dashboard's recent transactions widget now displays:
- Transaction name (instead of description)
- Updated to use new schema fields (`amount`, `transaction_type`)

## Files Modified

### Core Logic
1. **`lib/parseBankStatement.ts`**
   - Updated `ParsedTransaction` type to include `name` field
   - Modified parsing logic to split lines and extract name separately
   - Increased description limit from 200 to 500 characters

### API Routes
2. **`app/api/finance/upload-statement/route.ts`**
   - Updated INSERT query to include `transaction_name`
   - Modified error/skip logging to show name
   - Updated toast messages

3. **`app/api/telegram/webhook/route.ts`**
   - Updated INSERT query to include `transaction_name`
   - Modified error/skip logging

### UI Components
4. **`app/finance/page.tsx`**
   - Added `transaction_name` to SELECT query

5. **`app/finance/FinanceClient.tsx`**
   - Updated `Transaction` type to include `transaction_name`
   - Added Name column to table
   - Added Description column to table
   - Updated transaction detail dialog
   - Modified toast messages

6. **`app/dashboard/page.tsx`**
   - Updated query to fetch `transaction_name`
   - Changed to use new schema fields

7. **`app/dashboard/DashboardClient.tsx`**
   - Updated `Transaction` type
   - Changed display to show `transaction_name`

### Database Migration
8. **`supabase-add-transaction-name.sql`** (NEW)
   - Migration script to add the column
   - Backfills existing data

## Testing Checklist

After running the SQL migration:

- [ ] Upload a bank statement PDF
- [ ] Verify transactions have both name and description populated
- [ ] Check Finance page table shows Name and Description columns
- [ ] Click on a transaction to verify detail dialog shows both fields
- [ ] Check Dashboard shows transaction names correctly
- [ ] Send a PDF via Telegram bot
- [ ] Verify new transactions are parsed correctly

## Backward Compatibility

✅ **Existing transactions**: The migration copies the `description` field to `transaction_name`, so existing transactions will still display correctly.

✅ **New transactions**: Will have properly separated name and description fields.

## Benefits

1. **Better Organization**: Clear separation between transaction title and details
2. **Improved Readability**: Tables are easier to scan with concise names
3. **More Information**: Full descriptions available in detail view
4. **Matches Bank Format**: Aligns with how banks structure transaction data
5. **Better Search**: Can search by name or description separately in the future

## Next Steps (Optional Enhancements)

1. **Search Functionality**: Add ability to search by name or description
2. **Filters**: Filter transactions by name patterns
3. **Categories**: Auto-categorize based on transaction names
4. **Analytics**: Generate reports based on transaction name patterns
5. **Export**: Include both fields in CSV/Excel exports

