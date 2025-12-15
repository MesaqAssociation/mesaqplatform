/**
 * Setup script for Telegram Bot webhook
 * 
 * This script configures the Telegram bot to send updates to your webhook URL.
 * Run this once after deploying your application.
 * 
 * Usage:
 *   npx tsx scripts/setup-telegram-bot.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const WEBHOOK_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://mesaq-association.vercel.app'

async function setupWebhook() {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ Error: TELEGRAM_BOT_TOKEN environment variable is not set')
    console.log('\nPlease set it in your .env.local file:')
    console.log('TELEGRAM_BOT_TOKEN=your_bot_token_here')
    process.exit(1)
  }

  const webhookEndpoint = `${WEBHOOK_URL}/api/telegram/webhook`

  console.log('🤖 Setting up Telegram Bot webhook...')
  console.log(`📍 Webhook URL: ${webhookEndpoint}`)

  try {
    // Set webhook
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookEndpoint,
          allowed_updates: ['message', 'callback_query'],
          drop_pending_updates: true,
        }),
      }
    )

    const data = await response.json()

    if (data.ok) {
      console.log('✅ Webhook set successfully!')
      console.log(`\n📋 Webhook Info:`)
      console.log(`   URL: ${webhookEndpoint}`)
      console.log(`   Description: ${data.description || 'N/A'}`)
    } else {
      console.error('❌ Failed to set webhook:', data.description)
      process.exit(1)
    }

    // Get webhook info to verify
    const infoResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
    )
    const infoData = await infoResponse.json()

    if (infoData.ok) {
      console.log(`\n🔍 Current Webhook Status:`)
      console.log(`   URL: ${infoData.result.url}`)
      console.log(`   Pending updates: ${infoData.result.pending_update_count}`)
      console.log(`   Last error: ${infoData.result.last_error_message || 'None'}`)
      console.log(`   Max connections: ${infoData.result.max_connections || 40}`)
    }

    // Get bot info
    const botResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`
    )
    const botData = await botResponse.json()

    if (botData.ok) {
      console.log(`\n🤖 Bot Information:`)
      console.log(`   Name: ${botData.result.first_name}`)
      console.log(`   Username: @${botData.result.username}`)
      console.log(`   ID: ${botData.result.id}`)
      console.log(`\n✨ Your bot is ready to receive bank statements!`)
      console.log(`\n📱 Start a chat with your bot:`)
      console.log(`   https://t.me/${botData.result.username}`)
    }

  } catch (err: any) {
    console.error('❌ Error setting up webhook:', err.message)
    process.exit(1)
  }
}

async function removeWebhook() {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ Error: TELEGRAM_BOT_TOKEN environment variable is not set')
    process.exit(1)
  }

  console.log('🗑️  Removing Telegram Bot webhook...')

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drop_pending_updates: true,
        }),
      }
    )

    const data = await response.json()

    if (data.ok) {
      console.log('✅ Webhook removed successfully!')
    } else {
      console.error('❌ Failed to remove webhook:', data.description)
      process.exit(1)
    }
  } catch (err: any) {
    console.error('❌ Error removing webhook:', err.message)
    process.exit(1)
  }
}

// Check command line arguments
const args = process.argv.slice(2)
const command = args[0]

if (command === 'remove' || command === 'delete') {
  removeWebhook()
} else {
  setupWebhook()
}

