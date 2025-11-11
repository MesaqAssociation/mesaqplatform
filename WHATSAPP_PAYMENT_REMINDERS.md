# WhatsApp Payment Reminder System

## Overview
Automated payment reminder system that sends WhatsApp messages to members who haven't paid their monthly fees.

## Reminder Schedule

### Timeline
- **7th of next month**: First reminder (if unpaid)
  - Message to member
  - Notification to board group chat
- **14th of next month** (7 days later): Second reminder
  - Only if still unpaid
  - Message includes "if you've already paid, ignore this message"
- **7th of month after that**: Final action
  - **If fines enabled**: "You have been fined $X for late payment"
  - **If fines disabled**: Continue monthly reminders on the 7th

### Example
Member doesn't pay for January (due Jan 31):
- Feb 7: First reminder
- Feb 14: Second reminder
- Mar 7: Fine notice OR third reminder

## Environment Variables

### Required Variables

```bash
# WhatsApp Business API
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_permanent_access_token
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id

# Board Group Chat
WHATSAPP_BOARD_GROUP_ID=board_group_chat_id

# Testing (optional - for development only)
WHATSAPP_TEST_MODE=true
WHATSAPP_TEST_NUMBER=your_test_phone_number
```

### Getting These Values

#### 1. Set up Meta Business Account
1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create an App with WhatsApp Business API access
3. Add WhatsApp product to your app

#### 2. Get Phone Number ID
- Go to WhatsApp > API Setup
- Copy the "Phone Number ID" 

#### 3. Get Access Token
- Go to WhatsApp > API Setup
- Generate a permanent access token
- **Important**: Save this token securely!

#### 4. Get Business Account ID
- Found in your Business Settings > Business Info

#### 5. Get Board Group ID
- Add your phone number to the test numbers
- Create a group chat with board members
- Use WhatsApp API to get the group ID

## Testing Without Messaging Real Users

### Option 1: Test Mode (Recommended)

Set environment variables:
```bash
WHATSAPP_TEST_MODE=true
WHATSAPP_TEST_NUMBER=+1234567890  # Your test phone number
```

When test mode is enabled:
- All messages redirect to `WHATSAPP_TEST_NUMBER`
- Real user numbers are logged but not messaged
- You receive all messages with prefix: `[TEST for John Doe]`

### Option 2: Separate Test Database

```bash
# Create a test database
createdb mesaq_test

# Run migrations on test database
export DATABASE_URL=postgresql://user:pass@localhost/mesaq_test

# Add test users
```

### Option 3: WhatsApp Test Numbers

In Meta Developer Dashboard:
1. Go to WhatsApp > API Setup
2. Add test phone numbers (up to 5)
3. Only these numbers can receive messages in development mode

## Database Schema

### New Table: `payment_reminders`

```sql
CREATE TABLE payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  payment_month DATE NOT NULL,
  reminder_stage INTEGER NOT NULL DEFAULT 1, -- 1, 2, or 3
  last_reminder_date DATE,
  fine_applied BOOLEAN DEFAULT FALSE,
  fine_amount DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_reminders_user ON payment_reminders(user_id);
CREATE INDEX idx_payment_reminders_month ON payment_reminders(payment_month);
```

### New Settings

Add to `system_settings` table:

```sql
-- Enable/disable fines
INSERT INTO system_settings (key, value, description)
VALUES ('late_payment_fines_enabled', 'false', 'Enable fines for late payments');

-- Fine amount
INSERT INTO system_settings (key, value, description)
VALUES ('late_payment_fine_amount', '10.00', 'Fine amount for late payments (AUD)');
```

## API Endpoints

### 1. Run Payment Reminders (Cron Job)
```
POST /api/payment-reminders/run
```

Should be called daily by a cron service (Vercel Cron, GitHub Actions, etc.)

### 2. Update Fine Settings
```
POST /api/settings/fines
Body: {
  enabled: boolean,
  amount: number
}
```

## Message Templates

### First Reminder
```
Hi [Name],

This is a friendly reminder that your monthly membership fee of $[Amount] for [Month] is now overdue.

Please pay as soon as possible to keep your membership active.

Thank you!
[Organization Name]
```

### Second Reminder
```
Hi [Name],

This is your second reminder about your unpaid membership fee of $[Amount] for [Month].

If you've already paid, please ignore this message.

Please pay as soon as possible.

Thank you!
[Organization Name]
```

### Fine Notice (if enabled)
```
Hi [Name],

Your membership fee for [Month] remains unpaid.

A late fee of $[Fine] has been applied to your account.

Total owed: $[Total]

Please pay as soon as possible.

Thank you!
[Organization Name]
```

### Board Notification
```
⚠️ Payment Reminder Alert

Member: [Name]
Phone: [Phone]
Amount Owed: $[Amount]
Month: [Month]
Reminder: [Stage]

Action required: Follow up with member
```

## Cron Job Setup

### Option 1: Vercel Cron

Create `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/payment-reminders/run",
    "schedule": "0 2 * * *"
  }]
}
```

### Option 2: GitHub Actions

Create `.github/workflows/payment-reminders.yml`:
```yaml
name: Payment Reminders
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily
jobs:
  run-reminders:
    runs-on: ubuntu-latest
    steps:
      - name: Run reminders
        run: |
          curl -X POST https://yourapp.com/api/payment-reminders/run \\
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

### Option 3: External Cron Service

Use services like:
- cron-job.org
- EasyCron
- AWS EventBridge

## Implementation Checklist

- [ ] Set up Meta Business Account
- [ ] Get WhatsApp API credentials
- [ ] Add environment variables
- [ ] Create `payment_reminders` table
- [ ] Add fine settings to database
- [ ] Create `/api/payment-reminders/run` endpoint
- [ ] Create `/api/settings/fines` endpoint
- [ ] Add settings UI for board members
- [ ] Set up cron job
- [ ] Test with test numbers
- [ ] Deploy to production

## Security Considerations

1. **Never commit tokens**: Use environment variables
2. **Validate requests**: Check cron secret or auth token
3. **Rate limiting**: Prevent abuse of WhatsApp API
4. **Phone number validation**: Ensure valid format before sending
5. **Error handling**: Don't fail entire job if one message fails

## Cost Considerations

WhatsApp Business API pricing:
- First 1,000 conversations/month: Free
- After that: ~$0.005 - $0.01 per message
- Estimated cost for 100 members: $1-2/month

## Support & Troubleshooting

### Common Issues

**Messages not sending**:
- Check WhatsApp API credentials
- Verify phone number format (+country code)
- Check API quota limits

**Test mode not working**:
- Ensure `WHATSAPP_TEST_MODE=true`
- Verify test number format
- Check console logs

**Reminders not triggering**:
- Verify cron job is running
- Check server logs
- Ensure payment data is correct

## Future Enhancements

- [ ] SMS fallback for failed WhatsApp messages
- [ ] Custom message templates per language
- [ ] Payment link in messages
- [ ] Member opt-out preferences
- [ ] Reminder history dashboard

