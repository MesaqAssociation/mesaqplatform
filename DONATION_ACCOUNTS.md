# Donation Accounts Feature

This document explains the donation accounts feature for financial tracking.

## Overview

Donation accounts are special bank accounts that are tracked for viewing purposes only. Unlike regular accounts:
- Transactions are **NOT matched to members**
- Payments are **NOT detected** for membership fees
- Used for **viewing donations only**, separate from member payments

## Creating a Donation Account

### Via UI

1. Go to **Finance** page
2. Click **Add Account**
3. Fill in account details:
   - Account Name (e.g., "Donation Account")
   - Account Number (14 digits)
   - ✅ Check **"This is a donation account"**
4. Click **Add Account**

### Via API

```bash
POST /api/finance/accounts
Content-Type: application/json

{
  "account_name": "Donation Account",
  "account_number": "12345678901234",
  "is_donation_account": true
}
```

## How It Works

### For Regular Accounts

When you upload a bank statement to a regular account:
1. ✅ Transactions are parsed
2. ✅ Member names are detected in transaction descriptions
3. ✅ Payments are matched to members
4. ✅ Membership payment records are created
5. ✅ Member payment status is updated

### For Donation Accounts

When you upload a bank statement to a donation account:
1. ✅ Transactions are parsed
2. ❌ Member matching is **skipped**
3. ❌ No membership payments are created
4. ❌ Member payment status is **not affected**
5. ✅ Transactions are categorized as "Misc"

## Use Cases

### 1. Separate Donation Tracking
If your organization has a separate donation account that should not affect member payments:

```
Main Account → Track member payments
Donation Account → Track donations only (no member matching)
```

### 2. Grant/Funding Accounts
For accounts that receive grants or external funding that shouldn't be associated with members.

### 3. Event-Specific Accounts
For special events where you want to track funds separately from membership fees.

## Database Schema

```sql
ALTER TABLE financial_accounts 
ADD COLUMN is_donation_account BOOLEAN DEFAULT FALSE;
```

## Technical Details

### Account Creation

```typescript
// app/api/finance/accounts/route.ts (POST)
const { rows: newAccount } = await pool.query(
  `INSERT INTO financial_accounts (account_name, account_number, current_balance, is_donation_account)
   VALUES ($1, $2, 0.00, $3)
   RETURNING *`,
  [account_name, cleanNumber, is_donation_account || false]
)
```

### Statement Upload

```typescript
// app/api/finance/upload-statement/route.ts
const isDonationAccount = /* check account flag */

if (isDonationAccount) {
  console.log(`⚠️ Donation account detected - skipping member matching`)
  memberMatches = new Array(parsed.transactions.length).fill(null)
} else {
  memberMatches = await batchMatchTransactions(pool, transactions)
}
```

### Frontend UI

```tsx
<Checkbox 
  id="donation-account"
  checked={newAccountIsDonation}
  onCheckedChange={(checked) => setNewAccountIsDonation(checked === true)}
/>
<Label htmlFor="donation-account">
  <IconGift className="size-4" />
  This is a donation account (view only, no member matching)
</Label>
```

## Migration

To add the donation account flag to your existing database:

```bash
# Run the migration
psql $DATABASE_URL < supabase-donation-accounts.sql
```

Or manually:

```sql
ALTER TABLE financial_accounts 
ADD COLUMN IF NOT EXISTS is_donation_account BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_financial_accounts_donation 
ON financial_accounts(is_donation_account);

COMMENT ON COLUMN financial_accounts.is_donation_account IS 
'If true, transactions in this account will not be matched to members or processed for payments. For viewing donations only.';
```

## API Response Format

### GET /api/finance/accounts

```json
{
  "accounts": [
    {
      "id": "uuid",
      "account_name": "Main Account",
      "account_number": "12345678901234",
      "current_balance": 50000.00,
      "is_donation_account": false,
      "created_at": "2025-01-01T00:00:00Z"
    },
    {
      "id": "uuid",
      "account_name": "Donation Account",
      "account_number": "98765432109876",
      "current_balance": 10000.00,
      "is_donation_account": true,
      "created_at": "2025-01-15T00:00:00Z"
    }
  ]
}
```

## Notes

- Donation accounts still track balance and transactions
- You can still manually add transactions to donation accounts
- Manual matching is still possible in the UI (if needed)
- This only affects **automatic** member detection during statement upload
- Existing accounts default to `is_donation_account = false` (regular accounts)

## Example Workflow

1. Create a donation account for your organization's donation inbox
2. Upload monthly bank statements from the donation account
3. View all donations in the Finance page without affecting member payment tracking
4. Generate reports on total donations separately from member fees

This keeps your member payment tracking clean and accurate! 🎯

