# WhatsApp Setup - Simple Guide

## Current Setup: Manual Testing Only

The system is configured for **manual testing only**:
- ✅ Button on finance page to test reminders
- ✅ TEST MODE: All messages go to YOUR test number
- ❌ NO automatic messages
- ❌ NO cron jobs
- ❌ Real members will NOT be messaged

## Required Environment Variables

Go to **Vercel Dashboard** → **Your Project** → **Settings** → **Environment Variables**

Add these 3 variables:

```bash
# Required - API Credentials
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token

# Required for Testing - YOUR phone number
WHATSAPP_TEST_NUMBER=+61YOURNUMBER
```

### Where to Get These

1. **Go to Meta for Developers**: https://developers.facebook.com/
2. **Create/Login** to your account
3. **Create App** → Choose "Business" type
4. **Add WhatsApp** product
5. **Go to WhatsApp → API Setup**
6. **Copy values**:
   - Phone Number ID: Copy from "Phone Number ID" field
   - Access Token: Click "Generate" → Copy permanent token

### After Adding Variables

1. **Redeploy** your app in Vercel
2. Go to **Deployments** → Click ••• → **Redeploy**
3. Wait for deployment to complete

## How to Test

### Step 1: Check Configuration

Visit: `https://your-app.vercel.app/api/whatsapp/check`

You should see:
```json
{
  "ready": true,
  "testMode": true
}
```

- `ready: true` = All required variables set ✅
- `testMode: true` = Test number configured, safe to test ✅

If `ready: false`, check which variables are missing.

### Step 2: Send Test Messages

1. Go to **Finance page**
2. Click **🧪 Test Payment Reminders** button
3. Confirm the popup
4. Check YOUR WhatsApp for messages!

### What the Button Does

When you click the button:
- ✅ Checks who hasn't paid for last month
- ✅ Sends WhatsApp to YOUR test number (not real members)
- ✅ Each message shows who it would go to: `[TEST - Would send to: +61412345678]`
- ✅ Shows results in console
- ❌ Real members NOT messaged
- ❌ Does NOT store any data
- ❌ Does NOT run automatically

### Results Table

After clicking, check your browser console (F12):
```
name              | phone        | sent  | skipped | reason
------------------|--------------|-------|---------|---------------
John Doe          | 0412345678   | true  | false   | 
Jane Smith        | 0498765432   | false | true    | Already paid
```

## Current Status

- ✅ Manual button only
- ✅ TEST MODE: Messages go to YOUR number
- ✅ Shows who would get messages
- ❌ Real members NOT messaged
- ❌ NO automatic reminders
- ❌ NO cron jobs running

## When Ready for Production

Tell me when you want to enable automatic reminders, and I'll:
1. Re-enable the cron job
2. Set up automatic daily checks
3. Configure the 7th/14th day logic
4. Add board group notifications

## Environment Variables Summary

### Required (Must Have)
```bash
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxx
WHATSAPP_TEST_NUMBER=+61412345678  # YOUR phone - all messages go here
```

### Optional (For Later Production Use)
```bash
WHATSAPP_BOARD_GROUP_ID=120363xxx@g.us  # For board notifications
WHATSAPP_API_URL=https://graph.facebook.com/v18.0  # Default, usually not needed
```

## 🔒 Test Mode vs Production

### Current (Test Mode)
While `WHATSAPP_TEST_NUMBER` is set:
- ✅ ALL messages go to YOUR test number
- ✅ Message shows who it would go to in production
- ✅ Safe to test without bothering members
- ✅ Example: `[TEST - Would send to: +61412345678] Hi John, ...`

### Production (When Ready)
When you tell me to enable production:
- I'll remove the test number redirect
- Messages will go to actual members
- Automatic cron will be enabled
- You'll tell me when to make this switch

## Troubleshooting

### "Failed to send" in results table

**Check server logs** in Vercel:
1. Go to your project in Vercel
2. Click **Deployments**
3. Click latest deployment
4. Click **Functions** tab
5. Look for `/api/payment-reminders/test-send` errors

**Common issues**:
- ❌ Environment variables not set
- ❌ Didn't redeploy after adding variables
- ❌ Access token expired
- ❌ Phone number not verified in Meta
- ❌ Invalid phone number format

### Check Configuration

```bash
# Visit this endpoint
https://your-app.vercel.app/api/whatsapp/check

# Should return
{
  "ready": true,
  "missingRequired": []
}
```

### Test One Number

If all messages are failing, try:
1. Add your phone to Meta test numbers
2. Check Vercel function logs for detailed errors
3. Verify phone number format: `+61412345678`

## Phone Number Format

Australian numbers:
- ❌ `0412345678` (missing country code)
- ✅ `+61412345678` (correct)

The system auto-converts `04xx` → `+614xx` for Australian numbers.

## Support

If still having issues:
1. ✅ Check `/api/whatsapp/check` endpoint
2. ✅ Review Vercel function logs  
3. ✅ Verify Meta console shows phone number as active
4. ✅ Check access token hasn't expired

---

**Quick Check**: After setup, visit `/api/whatsapp/check` to verify! 🚀

