# Manual Transactions & Member Matching Feature

## Overview
This feature allows admins to manually add transactions and match transactions (including "Misc" transactions) to members.

## Features Implemented

### 1. Add Transaction Button
- **Location**: Finance page, next to "Add Bank Account" and "Upload Bank Statement" buttons
- **Functionality**: Opens a dialog where admins can manually add transactions
- **Fields**:
  - Date (required)
  - Transaction Type: Credit (Money In) or Debit (Money Out) (required)
  - Transaction Name (required)
  - Description (optional)
  - Amount (required)
  - Match to Member (optional) - Searchable dropdown

### 2. Member Matching for Misc Transactions
- **Location**: Finance table, Category column
- **How it works**:
  - "Misc" category badges are now clickable
  - Clicking opens a search dropdown to find members by name, email, or phone
  - Select a member to match the transaction to them
  - Matched transactions show the member's name in green
  - Can remove member matches by clicking "Remove member match" in the dropdown

## Database Changes

### New Column: `matched_member_id`
- **Table**: `transactions`
- **Type**: `UUID` (references `users.id`)
- **Purpose**: Links a transaction to a specific member
- **Migration File**: `supabase-add-matched-member.sql`

## API Endpoints

### 1. POST `/api/finance/transactions`
Creates a new manual transaction.

**Request Body**:
```json
{
  "accountId": "uuid",
  "transactionDate": "YYYY-MM-DD",
  "transactionName": "string",
  "description": "string (optional)",
  "amount": "number",
  "transactionType": "credit | debit",
  "matchedMemberId": "uuid (optional)"
}
```

**Response**:
```json
{
  "transaction": {
    "id": "uuid",
    "transaction_date": "YYYY-MM-DD",
    "transaction_name": "string",
    "description": "string",
    "category": "Member Payment | Misc",
    "amount": "number",
    "transaction_type": "credit | debit",
    "balance_after": "number",
    "matched_member_id": "uuid",
    "matched_member_name": "string",
    "creator_name": "string"
  }
}
```

### 2. PATCH `/api/finance/transactions`
Matches or unmatches a transaction to a member.

**Request Body**:
```json
{
  "transactionId": "uuid",
  "memberId": "uuid | null"
}
```

**Response**: Same as POST response

### 3. GET `/api/members?search={query}`
Searches members by name, email, or phone.

**Query Parameters**:
- `search`: Search query string

**Response**:
```json
{
  "members": [
    {
      "id": "uuid",
      "name": "string",
      "email": "string",
      "phone": "string",
      "member_id": "number",
      "banking_name": "string"
    }
  ]
}
```

## Installation Instructions

### Step 1: Run Database Migration
Execute the SQL migration to add the `matched_member_id` column:

```bash
# Using psql
psql $DATABASE_URL -f supabase-add-matched-member.sql

# Or using Supabase dashboard
# Copy contents of supabase-add-matched-member.sql and run in SQL Editor
```

### Step 2: Verify Installation
1. Navigate to the Finance page
2. You should see the new "Add Transaction" button
3. Click on any "Misc" category badge to open member search
4. Try adding a manual transaction

## Usage Guide

### Adding a Manual Transaction
1. Go to Finance page
2. Click "Add Transaction" button
3. Fill in the required fields:
   - Date: Select transaction date
   - Type: Choose Credit or Debit
   - Name: Enter transaction name
   - Amount: Enter amount
4. (Optional) Search and select a member to match
5. Click "Add Transaction"

### Matching a Misc Transaction to a Member
1. Go to Finance page
2. Find a transaction with "Misc" category
3. Click on the "Misc" badge
4. Search for a member by typing their name, email, or phone
5. Click on the member to match
6. The badge will turn green and show the member's name

### Removing a Member Match
1. Click on a matched transaction badge (green badge with member name)
2. Click "Remove member match" at the bottom of the dropdown
3. The transaction will revert to "Misc"

## Technical Details

### Category Logic
- If `matched_member_id` is set: Category = "Member Payment", badge shows member name in green
- If `matched_member_id` is null: Category = "Misc", badge is gray and clickable

### Balance Updates
When adding a transaction:
- Credit transactions: Add to current balance
- Debit transactions: Subtract from current balance
- Balance is automatically updated in the database

### Search Behavior
- Member search uses debounced input (300ms delay)
- Searches across name, email, and phone fields
- Case-insensitive search
- Returns up to 50 results

## Files Modified

1. **supabase-add-matched-member.sql** (NEW)
   - Database migration for matched_member_id column

2. **app/api/finance/transactions/route.ts**
   - Added POST endpoint for creating transactions
   - Added PATCH endpoint for matching members
   - Updated GET to include matched_member_id and matched_member_name

3. **app/api/members/route.ts**
   - Added search functionality with query parameter
   - Returns name, email, phone for member search

4. **app/finance/FinanceClient.tsx**
   - Added "Add Transaction" button and dialog
   - Made "Misc" badges clickable with member search dropdown
   - Added member search with real-time results
   - Added handlers for creating and matching transactions
   - Updated Transaction type to include matched member fields

## Future Enhancements

Potential improvements:
- Bulk import of manual transactions via CSV
- Transaction editing/deletion
- Transaction categories beyond "Misc" and "Member Payment"
- Advanced filtering by member
- Export transactions by member
- Automated member matching using AI/ML

