# Changes Log - January 16, 2026

## Summary of Changes Made

### 1. Export Member Data - Enhanced
**File:** `app/api/export/route.ts`

Added more fields to member export:
- `group_name` - Member's group
- `telegram_id` - Telegram integration
- `payment_plan` - Payment frequency (monthly/quarterly/etc)
- `is_active` - Account status
- `total_paid` - Total payments made
- `expected_months` - Expected payment months
- `balance` - Calculated balance
- `payment_status` - PAID/UNPAID

### 2. Finance Export - Added Matched Member
**File:** `app/api/export/route.ts`

- Added `matched_member` column to finance export
- Yes, expenses (debits) ARE included in the export

### 3. Board Member Report - Year-Specific Balance
**File:** `app/api/reports/board-members/route.ts`

- Changed `getMemberBalance()` to `getMemberBalanceAtDate(userId, endDate)`
- Report now shows balance AS OF the report end date, not current balance
- Fixes issue where generating a report for last year showed current balance

### 4. Clear All Button Removed
**File:** `app/finance/FinanceClient.tsx`

- Removed the "Clear All" button from the finance page
- This dangerous action is no longer available

### 5. Bank Adjustments Protection
**File:** `app/finance/FinanceClient.tsx`

- Bank adjustments (`transaction_type = 'adjustment'`) can no longer:
  - Have their category changed
  - Be matched to a member
- They display as "Bank Adjustment" with no dropdown

### 6. Transaction Delete - Balance No Longer Affected
**File:** `app/api/finance/transactions/route.ts`

- Deleting transactions no longer modifies the bank balance
- Balance should only be managed through statement uploads and manual adjustments
- This prevents accidental balance corruption

### 7. Community Documents Download Fix
**Files:** 
- `app/api/documents/download/[id]/route.ts` (NEW)
- `app/documents/DocumentsClient.tsx`

- Created a proxy download endpoint to avoid CORS issues with R2 storage
- Downloads now go through `/api/documents/download/[id]` instead of directly from R2 URL
- Supports both R2 URLs and data URLs

### 8. Messaging - Deactivated Members
**File:** `app/messaging/MessagingClient.tsx`

- Deactivated members are NOW included in individual conversation search
- Deactivated members are still EXCLUDED from bulk messaging
- Added separate member list that includes inactive for individual messaging

### 9. Member Reactivation - Balance Clearing
**File:** `app/api/members/[member_id]/deactivate/route.ts`

When reactivating a member:
- Their balance is calculated and stored
- A "Reactivation Balance Adjustment" transaction is created
- Their membership_payments records are deleted
- Their `date_joined` is reset to current date
- They start fresh with $0 balance

### 10. Previous Changes (from earlier today)

#### Review Payments Page
- Removed category column
- Added pagination (20 items per page)
- Added "Keep Special" button (marks as reviewed)
- Uses batch API for faster bulk processing

#### Unknown Transactions Page  
- Added pagination (20 items per page)
- Added "Keep as Unknown" button (marks as reviewed)
- Uses batch API

#### Bulk Update API
- Created `/api/finance/bulk-update` for batch operations
- Single API call instead of multiple for much faster processing
- Supports: mark_as_membership, mark_as_special, update_category, match_member, mark_as_reviewed

---

## Answers to Questions

### Q: Does export transactions export expenses too?
**A:** Yes, the finance export includes ALL transactions including debits (expenses).

### Q: If I create a report for last year does the balance show their current balance or that year's balance?
**A:** Now shows that year's balance (balance as of the report end date).

### Q: What is the payment_reminders table for in DB?
**A:** The `payment_reminders` table was used for a deprecated payment reminder system. The current system uses the `scheduled_notifications` table and the `/api/cron/daily` endpoint for payment reminders based on payment plans. The old table can be safely ignored.

---

## Files Modified

1. `app/api/export/route.ts` - Enhanced export functionality
2. `app/api/reports/board-members/route.ts` - Year-specific balance calculation
3. `app/finance/FinanceClient.tsx` - Removed clear all, protected adjustments
4. `app/api/finance/transactions/route.ts` - Delete no longer affects balance
5. `app/api/documents/download/[id]/route.ts` - NEW: Proxy download endpoint
6. `app/documents/DocumentsClient.tsx` - Use proxy download
7. `app/messaging/MessagingClient.tsx` - Allow messaging deactivated members
8. `app/api/members/[member_id]/deactivate/route.ts` - Reactivation clears balance

## Files Created

1. `app/api/documents/download/[id]/route.ts` - Document download proxy
2. `docs/USER_MANUAL.md` - Complete user manual
3. `docs/CHANGES_LOG_2026-01-16.md` - This file

