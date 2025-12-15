# 🔧 Telegram Bot Quick Fix - Not Responding

## 🐛 Issue
Bot is receiving messages but not responding.

## ✅ Solution

### Step 1: Update Webhook Configuration

The webhook needs to allow both `message` and `callback_query` updates.

**Run this command:**
```bash
npx tsx scripts/setup-telegram-bot.ts
```

This will reconfigure your webhook with the correct settings.

### Step 2: Verify Webhook Status

**Check webhook info:**
```bash
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo"
```

**You should see:**
```json
{
  "ok": true,
  "result": {
    "url": "https://your-domain.com/api/telegram/webhook",
    "allowed_updates": ["message", "callback_query"],
    ...
  }
}
```

### Step 3: Deploy Changes

If you're using Vercel or another platform:

1. **Commit and push your changes:**
   ```bash
   git add .
   git commit -m "Fix Telegram bot responses and add callback_query support"
   git push
   ```

2. **Wait for deployment to complete**

3. **Re-run webhook setup** (after deployment):
   ```bash
   npx tsx scripts/setup-telegram-bot.ts
   ```

### Step 4: Test

Send these messages to your bot:

1. **Test basic response:**
   ```
   You: Hello
   Bot: 👋 Hi! Use /create to create events or members...
   ```

2. **Test /start:**
   ```
   You: /start
   Bot: 👋 Welcome! You can:...
   ```

3. **Test /create:**
   ```
   You: /create
   Bot: [Shows buttons]
   ```

## 🎯 What Was Fixed

### 1. Added Default Responses
**Before:** Bot silently ignored regular messages
**After:** Bot responds with helpful guidance

```typescript
// Regular message when not in a flow
await sendTelegramMessage(chatId, '👋 Hi! Use /create to create events or members...')
```

### 2. Added Unknown Command Handler
**Before:** Unknown commands were ignored
**After:** Bot shows available commands

```typescript
// Unknown command
await sendTelegramMessage(chatId, '❓ Unknown command. Available commands:\n\n/start...')
```

### 3. Fixed Webhook Configuration
**Before:** Only `message` updates allowed
**After:** Both `message` and `callback_query` updates allowed

```typescript
allowed_updates: ['message', 'callback_query']
```

## 📋 Quick Test Checklist

- [ ] Webhook setup script executed
- [ ] Changes deployed to production
- [ ] Bot responds to "Hello" with helpful message
- [ ] `/start` command works
- [ ] `/create` command shows buttons
- [ ] Buttons work (callback queries)
- [ ] PDF upload still works

## 🔍 Still Not Working?

### Check Environment Variables
```bash
# Make sure TELEGRAM_BOT_TOKEN is set
echo $TELEGRAM_BOT_TOKEN
```

### Check Webhook URL
```bash
# Verify webhook is pointing to correct URL
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo"
```

### Check Server Logs
**Vercel:** Dashboard → Logs → Look for "Telegram webhook received"

**Local:** Check terminal output

### Test Webhook Manually
```bash
# Send test message to webhook
curl -X POST https://your-domain.com/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "chat": {"id": 123456789},
      "text": "/start"
    }
  }'
```

### Reset Webhook
```bash
# Remove webhook
npx tsx scripts/setup-telegram-bot.ts remove

# Wait 5 seconds

# Set webhook again
npx tsx scripts/setup-telegram-bot.ts
```

## 💡 Expected Behavior

### Regular Messages
```
User: Hi
Bot: 👋 Hi! Use /create to create events or members, or send a PDF bank statement to upload it.

Type /start for more info.
```

### Commands
```
User: /start
Bot: 👋 Welcome! You can:

📄 Send a PDF bank statement to upload it
➕ Use /create to create events or members
```

```
User: /create
Bot: ➕ What would you like to create?
     [📅 Create Event] [👤 Create Member]
```

```
User: /unknown
Bot: ❓ Unknown command. Available commands:

/start - Show welcome message
/create - Create event or member
/cancel - Cancel current operation
```

## 🚀 Next Steps

Once working:
1. Test event creation flow
2. Test member creation flow
3. Test PDF upload
4. Check database records are created
5. Verify button clicks work

## 📞 Common Error Messages

### "Webhook not set"
**Solution:** Run `npx tsx scripts/setup-telegram-bot.ts`

### "Bot token invalid"
**Solution:** Check `TELEGRAM_BOT_TOKEN` in environment variables

### "SSL error"
**Solution:** Make sure your domain uses HTTPS (Telegram requires it)

### "Callback query not handled"
**Solution:** Webhook must allow `callback_query` updates (fixed above)

---

**After following these steps, your bot should respond to all messages!** 🎉

