# WhatsApp Setup - Quick Start Guide

## ❌ Current Problem
Your WhatsApp messages are failing because the required environment variables are not set in Vercel.

## ✅ Solution: Set Environment Variables

### Step 1: Get WhatsApp API Credentials

#### Option A: Meta for Developers (Official - Free Tier Available)
1. Go to https://developers.facebook.com/
2. Create an account or log in
3. Click "My Apps" → "Create App"
4. Choose "Business" type
5. Add "WhatsApp" product
6. Go to WhatsApp → API Setup
7. Copy these values:
   - **Phone Number ID**: Found in "Phone Number ID" field
   - **Access Token**: Click "Generate" → Copy permanent token
   - **Test Number**: Your phone number to test with

#### Option B: Twilio (Easier but Paid)
1. Go to https://www.twilio.com/console/sms/whatsapp/sandbox
2. Sign up and verify your account
3. Get API credentials from console

### Step 2: Add to Vercel

1. Go to https://vercel.com/dashboard
2. Select your project (Mesaq)
3. Go to **Settings** → **Environment Variables**
4. Add these variables:

```bash
# Required - Without these, nothing will work
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional - For testing (HIGHLY RECOMMENDED)
WHATSAPP_TEST_MODE=true
WHATSAPP_TEST_NUMBER=+61412345678

# Optional - Board group notifications
WHATSAPP_BOARD_GROUP_ID=120363XXXXXXXXX@g.us
```

**Important**: 
- Add them to "Production", "Preview", and "Development" environments
- Click "Save" after adding each one
- **Redeploy** your app after adding variables

### Step 3: Redeploy Your App

After adding the environment variables:
1. Go to **Deployments** tab in Vercel
2. Click the "•••" menu on the latest deployment
3. Click "Redeploy"
4. ✓ Check "Use existing build cache" 
5. Click "Redeploy"

### Step 4: Test Configuration

Visit this URL (replace with your domain):
```
https://your-app.vercel.app/api/whatsapp/check
```

This will show you what's configured and what's missing.

## 🧪 Testing Before Going Live

### Set Test Mode
```bash
WHATSAPP_TEST_MODE=true
WHATSAPP_TEST_NUMBER=+61YOURTESTNUMBER
```

When test mode is enabled:
- ✅ All messages go to YOUR test number only
- ✅ Real user numbers are logged but NOT messaged
- ✅ Messages include `[TEST for John Doe]` prefix
- ✅ Safe to test without bothering real users

### Quick Test
1. Go to Finance page
2. Click **🧪 Test: Send Messages** button
3. Confirm the popup
4. Check your phone for WhatsApp messages
5. Check browser console for detailed logs

## 📱 Phone Number Format

Australian numbers must include country code:
- ❌ Wrong: `0412345678`
- ✅ Correct: `+61412345678`

The system automatically converts `04XXXXXXXX` → `+614XXXXXXXX`

## 🆘 Troubleshooting

### Still Getting "Failed to send"?

1. **Check Vercel deployment logs**:
   - Vercel Dashboard → Your Project → Deployments
   - Click latest deployment → Function Logs
   - Look for WhatsApp errors

2. **Check browser console**:
   - Press F12 → Console tab
   - Look for error messages

3. **Common Issues**:
   - ❌ Environment variables not saved
   - ❌ Didn't redeploy after adding variables
   - ❌ Wrong phone number format
   - ❌ Access token expired
   - ❌ Phone number not verified in Meta

### Check Your Configuration

Run this in your browser console while on the app:
```javascript
fetch('/api/whatsapp/check')
  .then(r => r.json())
  .then(console.log)
```

Look for `ready: true`. If `false`, check the `missingRequired` array.

## 🚀 Next Steps

Once messages are sending:
1. ✅ Test with test mode enabled
2. ✅ Verify messages arrive on your phone
3. ✅ Check message formatting looks good
4. ⚠️ Disable test mode for production
5. ✅ Set up board group ID for notifications

## 💰 Costs

**Meta WhatsApp Business API**:
- Free: First 1,000 conversations/month
- After: ~$0.005 per message
- For 50 members: ~$0.25/month

## 📞 Support

If still having issues:
1. Check `/api/whatsapp/check` endpoint
2. Review Vercel function logs
3. Verify WhatsApp Business account is active
4. Check phone number is verified in Meta console

## Environment Variables Summary

```bash
# REQUIRED (Messages won't send without these)
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token

# TESTING (Highly recommended for safety)
WHATSAPP_TEST_MODE=true
WHATSAPP_TEST_NUMBER=+61XXXXXXXXX

# OPTIONAL
WHATSAPP_API_URL=https://graph.facebook.com/v18.0  # Default, usually don't need to set
WHATSAPP_BOARD_GROUP_ID=group_id_here  # For board notifications
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_id  # Only for analytics
```

---

**Quick Check**: After setup, visit `/api/whatsapp/check` to verify everything is configured! 🎉

