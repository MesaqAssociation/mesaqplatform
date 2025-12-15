# 🤖 Telegram Bot Setup Guide

Automatically upload bank statements by sending PDFs to your Telegram bot, plus create events and members interactively!

## 📋 Features

- **Automatic PDF Processing**: Send a PDF → Bot extracts transactions → Adds to finance system
- **Interactive Event Creation**: Create events with guided buttons and inputs (see `/create`)
- **Interactive Member Creation**: Add members through conversational flow (see `/create`)
- **Real-time Feedback**: Get instant confirmation with transaction summary
- **Payment Detection**: Automatically detects membership payments
- **Error Reporting**: Shows which transactions failed and why
- **Secure**: Only processes PDFs, validates all data

---

## 🚀 Quick Start

### Step 1: Create a Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` command
3. Choose a name (e.g., "Mesaq Bank Statement Bot")
4. Choose a username (e.g., "mesaq_bank_bot")
5. BotFather will give you a **token** like: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

### Step 2: Add Token to Environment Variables

Add to your `.env.local` file:

```bash
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

Also add to your production environment (Vercel):
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add `TELEGRAM_BOT_TOKEN` with your token value
3. Redeploy your application

### Step 3: Set Up Webhook

After deploying your app, run:

```bash
npx tsx scripts/setup-telegram-bot.ts
```

This will:
- Configure Telegram to send updates to your webhook
- Verify the setup
- Show your bot's username and link

### Step 4: Start Using the Bot

1. Open Telegram
2. Search for your bot username (e.g., `@mesaq_bank_bot`)
3. Send `/start` to begin
4. Use the bot:
   - Send a PDF bank statement to upload transactions
   - Use `/create` to create events or add members interactively
   - Bot will guide you through each process!

---

## 💬 Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Show welcome message and instructions |
| `/create` | Create events or members with interactive buttons |
| `/cancel` | Cancel current creation process |
| Send PDF | Automatically process bank statement |

**📖 For detailed information about the `/create` command, see [TELEGRAM_CREATE_FEATURE.md](./TELEGRAM_CREATE_FEATURE.md)**

---

## 📊 What Happens When You Send a PDF

1. **Bot Receives PDF**
   ```
   📄 Bank statement received! Processing...
   ```

2. **PDF is Parsed**
   - Extracts all transactions
   - Identifies dates, amounts, descriptions
   - Validates data format

3. **Transactions Added to Database**
   - Imports to finance system
   - Updates account balance
   - Logs the upload

4. **Membership Payments Detected**
   - Matches transactions to members
   - Updates payment status

5. **Summary Sent Back**
   ```
   ✅ Bank statement processed successfully!
   
   📊 Summary:
   • Total transactions found: 25
   • Successfully imported: 23
   • Skipped (no amount): 1
   • Failed: 1
   
   💰 New balance: $12,345.67
   🏦 Account: 1234567890
   
   💳 Detected 3 membership payments!
   ```

---

## 🔧 Webhook Management

### Check Webhook Status

```bash
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo"
```

### Remove Webhook

```bash
npx tsx scripts/setup-telegram-bot.ts remove
```

### Update Webhook URL

Just run the setup script again:

```bash
npx tsx scripts/setup-telegram-bot.ts
```

---

## 🛡️ Security Features

1. **PDF Only**: Bot only accepts PDF files, rejects all other formats
2. **Validation**: All dates and amounts are validated before insertion
3. **Audit Trail**: Every upload is logged with Telegram user info
4. **No User Data Stored**: Bot doesn't store Telegram user data
5. **Webhook Only**: Bot uses webhooks (more secure than polling)

---

## 📝 Example Conversation

**User:**
```
/start
```

**Bot:**
```
👋 Hello John!

I'm the Mesaq Association Bank Statement Bot.

📄 Send me a PDF bank statement and I'll automatically:
• Extract all transactions
• Add them to your finance system
• Detect membership payments
• Update account balances

Just send me a PDF file to get started!
```

**User:** *[Sends PDF file]*

**Bot:**
```
📄 Bank statement received! Processing...
```

**Bot:**
```
✅ Bank statement processed successfully!

📊 Summary:
• Total transactions found: 15
• Successfully imported: 15

💰 New balance: $5,432.10
🏦 Account: 1234567890

💳 Detected 2 membership payments!
```

---

## 🐛 Troubleshooting

### Bot Doesn't Respond

**Check webhook status:**
```bash
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo"
```

**Common issues:**
- Webhook URL is wrong (should be `https://your-domain.com/api/telegram/webhook`)
- SSL certificate issues (Telegram requires HTTPS)
- Environment variable not set in production

**Solution:** Run setup script again:
```bash
npx tsx scripts/setup-telegram-bot.ts
```

### "Failed to process bank statement"

**Possible reasons:**
- PDF is not a valid bank statement
- PDF format is not supported
- Database connection issue

**Check logs:**
- Vercel: Dashboard → Your Project → Logs
- Look for "Telegram webhook error" or "Error processing bank statement"

### Transactions Not Being Imported

**The bot will tell you exactly why:**
```
⚠️ Skipped transactions:
• 2025-10-05: Monthly Fee (Reason: No transaction amount found)

❌ Failed transactions:
• invalid: Bad transaction (Error: Invalid date format)
```

**Also check:**
- Browser console (if you uploaded via web)
- Server logs for detailed parsing info

---

## 🔄 Updating the Bot

### After Code Changes

1. Deploy your changes to production
2. Webhook automatically uses new code (no setup needed)

### After Changing Webhook URL

1. Update `NEXT_PUBLIC_APP_URL` in environment variables
2. Run setup script:
   ```bash
   npx tsx scripts/setup-telegram-bot.ts
   ```

---

## 📱 Multiple Bots

You can create multiple bots for different purposes:

1. **Production Bot**: For real bank statements
   ```bash
   TELEGRAM_BOT_TOKEN=production_token
   ```

2. **Testing Bot**: For testing
   ```bash
   TELEGRAM_BOT_TOKEN=testing_token
   ```

Just use different tokens and they'll work independently!

---

## 🎯 Best Practices

1. **Keep Token Secret**: Never commit your bot token to Git
2. **Use Different Bots**: Production vs Testing
3. **Monitor Logs**: Check Vercel logs regularly
4. **Test First**: Send test PDFs before using in production
5. **Backup Data**: Always have database backups

---

## 📊 Audit Trail

Every bot upload is logged in the `audit_logs` table:

```sql
SELECT * FROM audit_logs 
WHERE action = 'telegram_bank_statement_upload' 
ORDER BY created_at DESC;
```

Includes:
- Telegram user ID
- Telegram user name
- File name
- Transactions found/imported
- Timestamp

---

## 🆘 Support

If you need help:

1. Check the logs (Vercel Dashboard → Logs)
2. Check webhook status (see Troubleshooting section)
3. Verify environment variables are set
4. Test with a simple PDF first

---

## 🎉 Success!

Once set up, you can:
- ✅ Send PDFs from your phone
- ✅ Get instant processing
- ✅ See detailed summaries
- ✅ Auto-detect payments
- ✅ No manual data entry!

**Just send a PDF to your bot and it handles everything!** 🚀

