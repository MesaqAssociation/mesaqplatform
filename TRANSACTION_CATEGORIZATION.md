# Transaction Categorization System

## Overview
Automatic categorization of transactions by matching them to members using phone numbers and banking names. Transactions that can't be matched are categorized as "Misc".

## How It Works

### Matching Priority

1. **Phone Identifier Matching (Highest Priority)**
   - Searches transaction description for ANY string stored in `users.phone` field
   - The phone field can contain:
     - Phone numbers: `0412345678`
     - Custom identifiers: `hdj3`, `A01`, `member123`
     - Any unique string: `john_smith`, `payment_id_456`
   - Case-insensitive matching
   - Simple substring search in description
   - Matches against `users.phone` field (any value)
   - Confidence: **High**
   - Examples:
     - Phone in DB: `hdj3` → Description: "Payment from hdj3" ✅
     - Phone in DB: `A01` → Description: "Membership fee A01" ✅
     - Phone in DB: `0412345678` → Description: "Transfer 0412345678" ✅

2. **Banking Name Matching (Second Priority)**
   - **Exact Match**: Banking name appears in transaction name
     - Example: "Transfer from ABDUL MOHAMMADI" → Matches member with banking_name "ABDUL MOHAMMADI"
     - Confidence: **High**
   
   - **Fuzzy Match**: All words from banking name appear in transaction
     - Requires at least 2 words, each longer than 2 characters
     - Example: "Transfer from GHULAM ABBAS NetBank" → Matches "GHULAM ABBAS"
     - Confidence: **Low**

3. **No Match (Default)**
   - Category: **"Misc"**
   - Used when no phone or banking name match is found

## Database Schema

### New Column
```sql
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Misc';

CREATE INDEX idx_transactions_category ON transactions(category);
```

### Column Details
- **Type**: TEXT
- **Default**: 'Misc'
- **Values**: Member name (e.g., "Abdul Mohammadi") or "Misc"
- **Indexed**: Yes (for faster filtering)

## Migration

Run this SQL script in Supabase SQL Editor:
```bash
supabase-add-transaction-category.sql
```

This will:
1. Add the `category` column
2. Create an index for performance
3. Set default value to 'Misc'
4. Add helpful comments

## API Integration

### Upload Statement Route
When a bank statement is uploaded:
1. PDF is parsed into transactions
2. **Batch matching** runs on all transactions
3. Each transaction gets a category (member name or "Misc")
4. Transactions are inserted with categories
5. Match statistics are logged

```typescript
// Example log output
=== Matching 33 transactions to members ===
✅ Matched 28 transactions to members
=== Inserting 33 transactions ===
```

### Telegram Bot
Same logic applies when PDFs are sent via Telegram:
1. Parse PDF
2. Batch match transactions
3. Insert with categories

## UI Display

### Transactions Table
New column added: **Category**

| Date | Name | Description | **Category** | Amount |
|------|------|-------------|--------------|--------|
| 2025-09-08 | Transfer from... | Membership A02 | **Abdul Mohammadi** | +$40.00 |
| 2025-09-10 | Unknown payment | Random | **Misc** | +$50.00 |

### Badge Styling
- **Member Names**: Blue badge (`bg-blue-100 text-blue-700`)
- **Misc**: Gray badge (`bg-gray-100 text-gray-700`)

### Transaction Detail Dialog
Category is displayed with the same badge styling:
- Date
- Name
- Description
- **Category** (with badge)
- Type
- Amount
- Balance After
- etc.

## Matching Examples

### Example 1: Custom Identifier Match
```
Member in DB: phone = "hdj3"
Transaction Name: "Fast Transfer From Unknown"
Description: "Payment from hdj3"
Result: ✅ Matched to member with phone identifier "hdj3"
Category: "John Smith"
Match Type: phone
Confidence: high
```

### Example 1b: Membership Code Match
```
Member in DB: phone = "A01"
Transaction Name: "Transfer"
Description: "Membership fee A01"
Result: ✅ Matched to member with phone identifier "A01"
Category: "Jane Doe"
Match Type: phone
Confidence: high
```

### Example 1c: Phone Number Match
```
Member in DB: phone = "0412345678"
Transaction Name: "Fast Transfer"
Description: "Payment 0412345678"
Result: ✅ Matched to member with phone identifier "0412345678"
Category: "Bob Wilson"
Match Type: phone
Confidence: high
```

### Example 2: Banking Name Match (Exact)
```
Transaction Name: "Transfer from ABDUL MOHAMMADI NetBank"
Description: "Membership A02"
Result: ✅ Matched to member with banking_name "ABDUL MOHAMMADI"
Category: "Abdul Mohammadi"
Match Type: banking_name
Confidence: high
```

### Example 3: Banking Name Match (Fuzzy)
```
Transaction Name: "Transfer from GHULAM ABBAS NetBank"
Description: "Membership A20"
Result: ✅ Matched to member with banking_name "GHULAM ABBAS"
Category: "Ghulam Abbas"
Match Type: banking_name
Confidence: low (fuzzy match)
```

### Example 4: No Match
```
Transaction Name: "ATM Withdrawal"
Description: "Cash withdrawal"
Result: ⚪ No match found
Category: "Misc"
Match Type: none
```

## Performance

### Batch Processing
- Uses `batchMatchTransactions()` for efficiency
- Loads all members once
- Creates lookup maps (phone → member, banking_name → member)
- Processes all transactions in one pass
- Much faster than individual queries

### Typical Performance
- 33 transactions matched in < 100ms
- Single database query to load members
- In-memory matching for speed

## Testing

### Test Script
```bash
npx tsx scripts/test-categorization.ts
```

This will:
1. Load test transactions
2. Run batch matching
3. Show results for each transaction
4. Display match statistics
5. Calculate match rate

### Expected Output
```
🧪 Testing Transaction Categorization

[1] Transaction: "Transfer from ABDUL MOHAMMADI NetBank"
    ✅ MATCHED
    👤 Member: Abdul Mohammadi
    🔗 Match Type: banking_name
    📊 Confidence: high

[2] Transaction: "Payment from 0412345678"
    ✅ MATCHED
    👤 Member: John Smith
    🔗 Match Type: phone
    📊 Confidence: high

[3] Transaction: "Unknown payment"
    ⚪ NO MATCH (Category: Misc)

📈 Summary:
   ✅ Matched: 2
   ⚪ Misc: 1
   📊 Total: 3
   🎯 Match Rate: 66.7%
```

## Files Modified

### Core Logic
1. **`lib/matchTransactionToMember.ts`** (NEW)
   - `matchTransactionToMember()` - Single transaction matching
   - `batchMatchTransactions()` - Batch processing
   - Phone number extraction
   - Banking name matching (exact + fuzzy)

### API Routes
2. **`app/api/finance/upload-statement/route.ts`**
   - Import batch matching function
   - Call matching before inserting transactions
   - Pass category to INSERT query
   - Log match statistics

3. **`app/api/telegram/webhook/route.ts`**
   - Same updates as upload-statement route
   - Categorize transactions from Telegram bot

### UI Components
4. **`app/finance/page.tsx`**
   - Added `category` to SELECT query

5. **`app/finance/FinanceClient.tsx`**
   - Updated Transaction type to include category
   - Added Category column to table
   - Added category badge styling
   - Display category in detail dialog

### Database
6. **`supabase-add-transaction-category.sql`** (NEW)
   - Migration script

### Testing
7. **`scripts/test-categorization.ts`** (NEW)
   - Test script for matching logic

## Benefits

### For Users
- 📊 **Automatic Attribution**: See which member each transaction is from
- 🔍 **Easy Filtering**: Filter transactions by member (future feature)
- 📈 **Better Tracking**: Track payments per member
- 🎯 **High Accuracy**: Smart matching with phone and banking names

### For Administrators
- ⚡ **Fast Processing**: Batch matching is efficient
- 🔧 **Flexible**: Supports exact and fuzzy matching
- 📝 **Audit Trail**: Match type and confidence logged
- 🛠️ **Maintainable**: Clean separation of concerns

## Future Enhancements

1. **Category Filtering**
   - Add dropdown to filter by category
   - Show transactions per member

2. **Manual Override**
   - Allow admins to manually change category
   - Useful for incorrect matches

3. **Match Confidence Display**
   - Show confidence level in UI
   - Flag low-confidence matches for review

4. **Analytics**
   - Total received per member
   - Payment frequency
   - Member contribution reports

5. **Duplicate Detection**
   - Flag when multiple members match
   - Require manual selection

## Troubleshooting

### Transaction Not Matching

**Check Phone Identifier:**
- Can be ANY string value (not just numbers)
- Must appear in description field (case-insensitive)
- Member must have phone field set in database
- Examples: "hdj3", "A01", "0412345678", "member_123"

**Check Banking Name:**
- Must be set in member profile
- Check for typos
- Try exact match first
- Fuzzy match requires 2+ words

### All Transactions Show "Misc"

1. Verify members have phone numbers or banking names set
2. Check database connection
3. Run test script to verify matching logic
4. Check console logs for errors

### Wrong Member Matched

1. Check for duplicate banking names
2. Verify phone number is correct
3. Consider adding more specific banking names
4. Review fuzzy match logic

## Support

For issues or questions:
1. Check console logs for match statistics
2. Run test script: `npx tsx scripts/test-categorization.ts`
3. Verify member data (phone, banking_name)
4. Review match confidence levels

