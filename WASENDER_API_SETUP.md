# Wasender API Setup

## Overview

The system has been switched from the official WhatsApp Business API to **wasenderapi** for sending WhatsApp messages.

## Changes Made

### 1. Updated WhatsApp Library (`lib/whatsapp.ts`)
- Removed official WhatsApp API (Meta/Facebook Graph API)
- Implemented wasenderapi integration
- Now uses simple endpoint: `https://wasenderapi.com/api/send-message`
- Only requires `WASENDER_API_KEY` environment variable

### 2. Updated Test Endpoint (`app/api/payment-reminders/test-send/route.ts`)
- **New Functionality**: Sends ALL members' balance status
- Calculates running balance for each member
- Shows:
  - `+` for credit (member is ahead on payments)
  - `-` for debt (member is behind on payments)
- Includes summary statistics:
  - How many members are behind
  - How many members are ahead
  - Total debt and credit amounts

### 3. Updated Test Button (`app/finance/FinanceClient.tsx`)
- Updated confirmation dialog to reflect new functionality
- Button still located on Finance page
- Label: "🧪 Test Payment Reminders"

## Environment Variables Required

Add to your `.env.local` or Vercel environment variables:

```bash
# Wasender API Key (required)
WASENDER_API_KEY=your_token_here

# Test phone number to receive messages (required for testing)
WHATSAPP_TEST_NUMBER=+1234567890
```

### No Longer Needed
You can remove these old WhatsApp API variables:
- ~~WHATSAPP_PHONE_NUMBER_ID~~
- ~~WHATSAPP_ACCESS_TOKEN~~
- ~~WHATSAPP_API_URL~~

## How to Use

### Testing the System

1. **Set Environment Variables**:
   - Add `WASENDER_API_KEY` with your wasenderapi token
   - Add `WHATSAPP_TEST_NUMBER` with your phone number

2. **Click the Test Button**:
   - Go to Finance page
   - Click "🧪 Test Payment Reminders" button
   - Confirm the dialog

3. **Check Your Phone**:
   - You'll receive a WhatsApp message with:
     - Complete list of all members
     - Each member's balance (+$XX.XX or -$XX.XX)
     - Summary statistics

## Message Format

The test message will look like:

```
📊 MEMBER BALANCE REPORT
Date: 30/11/2025
Total Members: 45
━━━━━━━━━━━━━━━━━━━━

❌ John Smith
   ID: 101 | Balance: -$120.00
   Phone: +61412345678

✅ Jane Doe
   ID: 102 | Balance: +$40.00
   Phone: +61498765432

━━━━━━━━━━━━━━━━━━━━
📈 SUMMARY
Behind: 12 members (-$1,450.00)
Ahead: 8 members (+$320.00)
Even: 25 members
```

## API Format

### Wasender API Request
```bash
curl -X POST "https://wasenderapi.com/api/send-message" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to": "+1234567890", "text": "Hello from API!"}'
```

### Code Implementation
```typescript
const response = await fetch('https://wasenderapi.com/api/send-message', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.WASENDER_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: cleanPhone,
    text: messageBody
  })
})
```

## Testing Checklist

- [ ] Add `WASENDER_API_KEY` to environment variables
- [ ] Add `WHATSAPP_TEST_NUMBER` to environment variables
- [ ] Redeploy application (if on Vercel)
- [ ] Navigate to Finance page
- [ ] Click test button
- [ ] Confirm you receive the WhatsApp message
- [ ] Verify all members are listed with correct balances

## Balance Calculation Logic

For each member:
1. Get all months since they joined
2. For each month, member owes the monthly fee
3. Subtract all payments made
4. Running balance = (Total Paid) - (Months × Monthly Fee)

Examples:
- Joined 5 months ago, monthly fee $40, paid $200 → Balance: $0 (even)
- Joined 5 months ago, monthly fee $40, paid $240 → Balance: +$40 (ahead)
- Joined 5 months ago, monthly fee $40, paid $120 → Balance: -$80 (behind)

## Notes

- This is a **test-only** feature
- NO production messages are sent to real members
- All messages go to `WHATSAPP_TEST_NUMBER`
- NO data is stored in the database
- Calculations are done in real-time each time you click the button

