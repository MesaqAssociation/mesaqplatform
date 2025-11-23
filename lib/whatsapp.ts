/**
 * WhatsApp Business API Integration
 * Sends messages via Meta's WhatsApp Business Platform
 */

export type WhatsAppMessage = {
  to: string // Phone number with country code (e.g., +61412345678)
  body: string
}

/**
 * Send a WhatsApp message
 * In test mode (if WHATSAPP_TEST_NUMBER is set), all messages go to that number
 */
export async function sendWhatsAppMessage(message: WhatsAppMessage): Promise<boolean> {
  try {
    const { to, body } = message
    const testNumber = process.env.WHATSAPP_TEST_NUMBER

    // If test number is configured, send ALL messages there instead
    if (testNumber) {
      console.log(`🧪 TEST MODE: Redirecting message for ${to} to test number`)
      const testBody = `[TEST - Would send to: ${to}]\n\n${body}`
      return await sendActualMessage(testNumber, testBody)
    }

    // Production mode - send to actual number
    console.log(`📤 PRODUCTION: Sending to actual number ${to}`)
    return await sendActualMessage(to, body)
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error)
    return false
  }
}

/**
 * Send message using WhatsApp Business API
 */
async function sendActualMessage(to: string, body: string): Promise<boolean> {
  const apiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0'
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    console.error('❌ WhatsApp API credentials not configured')
    console.error('   Missing:', {
      phoneNumberId: !phoneNumberId ? 'WHATSAPP_PHONE_NUMBER_ID' : '✓',
      accessToken: !accessToken ? 'WHATSAPP_ACCESS_TOKEN' : '✓'
    })
    return false
  }

  try {
    const cleanPhone = to.replace(/\s+/g, '') // Remove spaces from phone number
    console.log(`📤 Sending WhatsApp to: ${cleanPhone}`)
    
    const response = await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'text',
        text: {
          body: body
        }
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('❌ WhatsApp API error:', {
        status: response.status,
        statusText: response.statusText,
        error: error
      })
      return false
    }

    const result = await response.json()
    console.log(`✅ WhatsApp message sent to ${to}`, result)
    return true
  } catch (error) {
    console.error('❌ Error calling WhatsApp API:', error)
    return false
  }
}

/**
 * Send message to board group chat
 * In test mode, also goes to test number
 */
export async function sendBoardNotification(message: string): Promise<boolean> {
  const testNumber = process.env.WHATSAPP_TEST_NUMBER
  const boardGroupId = process.env.WHATSAPP_BOARD_GROUP_ID

  // In test mode, send to test number
  if (testNumber) {
    console.log('🧪 TEST MODE: Sending board notification to test number')
    return await sendWhatsAppMessage({
      to: testNumber,
      body: `[BOARD NOTIFICATION]\n\n${message}`
    })
  }

  // Production mode - send to board group
  if (!boardGroupId || boardGroupId.trim() === '') {
    console.warn('Board group ID not configured, skipping board notification')
    return false
  }

  return await sendWhatsAppMessage({
    to: boardGroupId,
    body: message
  })
}

/**
 * Format phone number for WhatsApp (ensure + and country code)
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '')

  // If doesn't start with country code, assume Australian +61
  if (!phone.startsWith('+')) {
    // Remove leading 0 if present
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1)
    }
    // Add Australian country code
    cleaned = '61' + cleaned
  }

  return '+' + cleaned
}

/**
 * Generate first reminder message
 */
export function generateFirstReminderMessage(name: string, amount: number, month: string): string {
  return `Hi ${name},

This is a friendly reminder that your monthly membership fee of $${amount.toFixed(2)} for ${month} is now overdue.

Please pay as soon as possible to keep your membership active.

Thank you!
Mesaq Association`
}

/**
 * Generate second reminder message
 */
export function generateSecondReminderMessage(name: string, amount: number, month: string): string {
  return `Hi ${name},

This is your second reminder about your unpaid membership fee of $${amount.toFixed(2)} for ${month}.

If you've already paid, please ignore this message.

Please pay as soon as possible.

Thank you!
Mesaq Association`
}

/**
 * Generate fine notice message
 */
export function generateFineNoticeMessage(name: string, originalAmount: number, fineAmount: number, month: string): string {
  const total = originalAmount + fineAmount
  return `Hi ${name},

Your membership fee for ${month} remains unpaid.

A late fee of $${fineAmount.toFixed(2)} has been applied to your account.

Total owed: $${total.toFixed(2)}

Please pay as soon as possible.

Thank you!
Mesaq Association`
}

/**
 * Generate continued reminder message (if fines disabled)
 */
export function generateContinuedReminderMessage(name: string, amount: number, month: string): string {
  return `Hi ${name},

Your membership fee of $${amount.toFixed(2)} for ${month} is still overdue.

Please pay as soon as possible to maintain your membership.

Thank you!
Mesaq Association`
}

/**
 * Generate board notification message
 */
export function generateBoardNotification(name: string, phone: string, amount: number, month: string, stage: number): string {
  const stageNames = ['', 'First', 'Second', 'Final']
  return `⚠️ Payment Reminder Alert

Member: ${name}
Phone: ${phone}
Amount Owed: $${amount.toFixed(2)}
Month: ${month}
Reminder: ${stageNames[stage] || 'Unknown'}

Action required: Follow up with member`
}

