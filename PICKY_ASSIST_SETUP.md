# Picky Assist WhatsApp Integration Setup

This document explains how to configure Picky Assist for WhatsApp messaging in the Mesaq system.

## Required Environment Variables

Add these to your `.env.local` file (or Vercel environment variables):

```env
# Picky Assist Configuration
PICKY_ASSIST_API_KEY=your_api_key_here
PICKY_ASSIST_PROJECT_ID=your_project_id_here
PICKY_ASSIST_BOT_ID=your_bot_id_here  # Optional, for specific bot

# Optional: Test mode (all messages go to this number)
WHATSAPP_TEST_NUMBER=+61412345678
```

## Getting Your Picky Assist Credentials

1. Log in to your Picky Assist dashboard at https://app.pickyassist.com
2. Navigate to **Settings** > **API Keys**
3. Copy your API Key
4. Navigate to **Projects** and copy your Project ID
5. If using a specific bot, copy the Bot ID from **Bots** section

## Features

### Sending Messages

The system supports:
- **Template Messages**: Pre-approved WhatsApp templates (required for messages outside 24h window)
- **Text Messages**: Simple text messages (only works within 24h of customer interaction)

### Incoming Messages

The messaging page now shows incoming messages from members:
1. Go to **Messaging** in the sidebar
2. Click the **Incoming Messages** tab
3. Click **Refresh** to load latest messages

Note: Incoming messages are read-only. Replies must be sent through the "Send Messages" tab.

## Template Messages

For business-initiated messages (e.g., payment reminders), you need WhatsApp-approved templates:

1. Create templates in your Picky Assist dashboard
2. Submit for WhatsApp approval
3. Use the template name in your code

Example template usage:
```typescript
import { sendPickyAssistTemplate } from '@/lib/picky-assist'

await sendPickyAssistTemplate({
  to: '+61412345678',
  templateName: 'payment_reminder',
  templateParams: ['John', '$40.00', 'December'],
  language: 'en'
})
```

## Testing

Set `WHATSAPP_TEST_NUMBER` to redirect ALL messages to a single test number during development.

## Scheduled Notifications

Scheduled notifications (Calendar page) will automatically use Picky Assist when triggered:
- Via cron job calling `/api/notifications/send-due`
- Or manually through the calendar interface

## Migrated from WASender

The system was previously using WASender. All references have been updated to use Picky Assist instead. The old `WASENDER_API_KEY` environment variable is no longer needed.

