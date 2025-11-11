# Testing Payment Reminders System

This guide explains how to test the WhatsApp payment reminders system without waiting for real-time to pass.

## Test Acceleration Mode

When enabled, **1 minute in real time = 1 day in system time**. This allows you to test a full month cycle in 30 minutes.

## Setup

### 1. Enable Test Mode

Add these environment variables to your `.env.local`:

```env
# Enable WhatsApp test mode (sends to test number instead of real users)
WHATSAPP_TEST_MODE=true
WHATSAPP_TEST_NUMBER=+1234567890  # Your test phone number

# Enable time acceleration (1 min = 1 day)
WHATSAPP_TEST_ACCELERATION=true
```

### 2. Cron Configuration

**Important**: In test mode (1 minute = 1 day), you need the cron to run every minute, not once per day!

#### Option A: Local Testing (Recommended)
Keep production cron as-is and manually trigger for testing:
```bash
# Run manually at the right minutes (7, 14, 37)
curl -X POST http://localhost:3000/api/payment-reminders/run
```

#### Option B: Automated Testing on Vercel Preview
If testing on a Vercel preview deployment, update `vercel.json` to run every minute:

```json
{
  "crons": [
    {
      "path": "/api/payment-reminders/run",
      "schedule": "* * * * *"
    }
  ]
}
```

⚠️ **Remember to change back to daily schedule before production deployment:**
```json
{
  "crons": [
    {
      "path": "/api/payment-reminders/run",
      "schedule": "0 12 * * *"
    }
  ]
}
```

## Testing Workflow

### Option 1: Manual Testing (Recommended)

1. **Reset the test timer** (sets current time as Day 1):
   ```bash
   curl -X POST http://localhost:3000/api/payment-reminders/test-reset
   ```

2. **Check current test status**:
   ```bash
   curl http://localhost:3000/api/payment-reminders/test-reset
   ```
   
   Response example:
   ```json
   {
     "testMode": true,
     "info": "⏱️ Test Mode Active\nReal elapsed: 7 minutes\nSystem date: 11/18/2025 (Day 7)\n1 real minute = 1 system day"
   }
   ```

3. **Manually trigger reminder checks**:
   ```bash
   curl -X POST http://localhost:3000/api/payment-reminders/run
   ```

4. **Timeline** (after reset):
   - **Minute 7**: First reminders sent (Day 7 of month)
   - **Minute 14**: Second reminders sent (Day 14 of month)
   - **Minute 37**: Final reminders/fines sent (Day 7 of next month)
   
   Run the trigger command at these intervals to test each stage.

### Option 2: Automated Local Testing

Set up a local scheduler to run checks every minute using `watch`:

```bash
# Run every 1 minute (60 seconds) for 40 minutes
# This simulates 40 days in test mode
watch -n 60 'curl -X POST http://localhost:3000/api/payment-reminders/run'
```

Or use a simple bash loop:
```bash
#!/bin/bash
# Run for 40 minutes (40 days in test mode)
for i in {1..40}; do
  echo "Minute $i (Day $i)"
  curl -X POST http://localhost:3000/api/payment-reminders/run
  sleep 60
done
```

### Option 3: Automated Testing on Vercel

If you want fully automated testing on a Vercel preview deployment:

1. **Update vercel.json** for test environment:
```json
{
  "crons": [
    {
      "path": "/api/payment-reminders/run",
      "schedule": "* * * * *"
    }
  ]
}
```

2. **Deploy to preview** with test mode environment variables
3. **Wait and monitor** - reminders will trigger automatically every minute
4. **Check at minutes 7, 14, 37** to see the different reminder stages

## Test Scenarios

### Scenario 1: Member with Unpaid Balance

1. **Setup**: Create a test member who hasn't paid last month
2. **Day 7** (Minute 7): First reminder sent to test number
3. **Day 14** (Minute 14): Second reminder sent to test number
4. **Day 37** (Minute 37): Final reminder or fine sent to test number

### Scenario 2: Member Who Pays After First Reminder

1. **Day 7** (Minute 7): First reminder sent
2. Before minute 14, manually add a payment for the member:
   ```sql
   INSERT INTO membership_payments (user_id, payment_month, amount, status, payment_date)
   VALUES ('member_id', '2025-10-01', 50.00, 'paid', CURRENT_DATE);
   ```
3. **Day 14** (Minute 14): No second reminder (member paid)

### Scenario 3: Testing Fines

1. Enable fines in settings:
   ```sql
   UPDATE system_settings SET value = 'true' WHERE key = 'late_payment_fines_enabled';
   UPDATE system_settings SET value = '10.00' WHERE key = 'late_payment_fine_amount';
   ```
2. Follow Scenario 1 timeline
3. At Day 37 (Minute 37): Fine notice sent instead of continued reminder

## Verifying Results

### Check WhatsApp Messages
- All messages will be sent to `WHATSAPP_TEST_NUMBER`
- Board notifications will also go to test number (not to board group)

### Check Database

```sql
-- Check reminder records
SELECT 
  u.name,
  pr.payment_month,
  pr.reminder_stage,
  pr.last_reminder_date,
  pr.fine_applied,
  pr.fine_amount
FROM payment_reminders pr
JOIN users u ON pr.user_id = u.id
ORDER BY pr.updated_at DESC;

-- Check payments
SELECT 
  u.name,
  mp.payment_month,
  mp.amount,
  mp.status,
  mp.payment_date
FROM membership_payments mp
JOIN users u ON mp.user_id = u.id
WHERE mp.payment_month >= '2025-10-01'
ORDER BY mp.payment_date DESC;
```

### Check Logs

View the API response for detailed logs:

```bash
curl -X POST http://localhost:3000/api/payment-reminders/run | jq
```

Example response:
```json
{
  "success": true,
  "date": "2025-11-18",
  "dayOfMonth": 7,
  "testMode": true,
  "testInfo": "⏱️ Test Mode Active\nReal elapsed: 7 minutes...",
  "remindersSent": 3,
  "errors": 0
}
```

## Resetting for Another Test

To run the test again:

1. Reset test timer:
   ```bash
   curl -X POST http://localhost:3000/api/payment-reminders/test-reset
   ```

2. Clear previous test data (optional):
   ```sql
   DELETE FROM payment_reminders WHERE created_at >= '2025-11-11';
   ```

3. Re-run your test scenarios

## Production Deployment

⚠️ **IMPORTANT**: Before deploying to production:

1. **Disable test modes** in production environment:
   ```env
   WHATSAPP_TEST_MODE=false
   WHATSAPP_TEST_ACCELERATION=false
   # Remove TEST_START_TIME if set
   ```

2. **Restore daily cron schedule** in `vercel.json`:
   ```json
   {
     "crons": [
       {
         "path": "/api/payment-reminders/run",
         "schedule": "0 12 * * *"
       }
     ]
   }
   ```
   
   **Cron schedule explanation:**
   - Production: `0 12 * * *` = Once daily at 12:00 PM
   - Test mode: `* * * * *` = Every minute (only use for testing!)

3. **Set production WhatsApp settings**:
   ```env
   WHATSAPP_BOARD_GROUP_ID=your_board_group_id
   ```

## Troubleshooting

### Issue: No messages being sent

**Check**:
- WhatsApp API credentials are correct
- `WHATSAPP_TEST_NUMBER` is in correct format (+countrycode + number)
- WhatsApp reminders are enabled: `SELECT value FROM system_settings WHERE key = 'whatsapp_reminders_enabled'`

### Issue: Wrong day showing

**Solution**: Reset the test timer:
```bash
curl -X POST http://localhost:3000/api/payment-reminders/test-reset
```

### Issue: Reminders not triggering at right time

**Remember**: Reminders only trigger on Day 7 and Day 14. At other days, the API will return a message saying it's not a reminder day.

## Environment Variables Summary

```env
# Required for testing
WHATSAPP_TEST_MODE=true
WHATSAPP_TEST_NUMBER=+1234567890
WHATSAPP_TEST_ACCELERATION=true

# Will be set automatically by test-reset endpoint
TEST_START_TIME=2025-11-11T10:00:00.000Z

# Optional for production
CRON_SECRET=your_secret_here
```

