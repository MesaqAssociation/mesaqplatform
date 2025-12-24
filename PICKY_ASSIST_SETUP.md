# Picky Assist WhatsApp Integration Setup

This document explains how to configure Picky Assist for WhatsApp messaging in the Mesaq system.

## Required Environment Variables

Add these to your `.env.local` file (or Vercel environment variables):

```env
# Picky Assist Configuration
PICKY_ASSIST_API_KEY=your_api_key_here
PICKY_ASSIST_PAYMENT_APPLICATION_ID=121

# Template IDs
PICKY_ASSIST_PAYMENT_TEMPLATE_ID=XA185499179

# Optional: Test mode (all messages go to this number)
WHATSAPP_TEST_NUMBER=+61426825847
```

## API Format

Picky Assist uses the following API format:

```json
{
  "token": "PICKY_ASSIST_API_KEY",
  "application": 121,
  "template_id": "XA185499179",
  "data": [
    {
      "number": "+61426825847",
      "template_message": [
        "Abdullah",
        "60",
        "763-901",
        "9001 7788"
      ],
      "language": "en"
    }
  ]
}
```

## Payment Reminder Template (XA185499179)

The payment reminder template uses 4 parameters:
1. **Name** - Member's name
2. **Balance** - Amount owed (positive number)
3. **BSB** - Bank BSB number (from main account)
4. **Account Number** - Bank account number (from main account)

## Phone Number Formatting

The system automatically converts Australian phone numbers:
- `0412345678` → `+61412345678`
- `04xyz` → `+614xyz`
- `412345678` → `+61412345678`

## Sending Payment Reminders

### Via Settings Page

1. Go to **Settings** > **Community Settings**
2. Scroll to **Payment Reminders** section
3. You can:
   - **Test Mode**: Select a specific member and send their actual reminder message to your test number
   - **Send to All**: Send reminders to all members with negative balance

### Via API

```bash
# Preview members who would receive reminders
GET /api/payment-reminders/send

# Send test reminder (to test number)
POST /api/payment-reminders/send
{
  "testMode": true,
  "memberId": "uuid-of-member"
}

# Send all reminders
POST /api/payment-reminders/send
{
  "testMode": false
}
```

## Templates Available

| Template ID | Purpose | Parameters |
|-------------|---------|------------|
| XA185499179 | Payment Reminder | Name, Balance, BSB, Account Number |
| (TBD) | Event Notification | (To be configured) |
| (TBD) | Admin Message | (To be configured) |

## Test Mode Behavior

When `WHATSAPP_TEST_NUMBER` is set:
- In Settings, you can select any member and send their actual message content to your test number
- This allows you to verify the message format before sending to real members
- The test number receives the exact message that would be sent to the selected member

## Account Information

The BSB and Account Number are automatically pulled from your **main financial account** (non-donation account). Make sure your main account has these fields filled in:
1. Go to **Finance** page
2. Click on your main account settings
3. Ensure BSB and Account Number are set

## Migrating from WASender

The system was previously using WASender. All references have been updated to use Picky Assist. The old `WASENDER_API_KEY` environment variable is no longer needed and can be removed.
