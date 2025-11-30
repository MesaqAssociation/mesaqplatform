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
 * Send message using wasenderapi
 */
async function sendActualMessage(to: string, body: string): Promise<boolean> {
  const apiKey = process.env.WASENDER_API_KEY

  if (!apiKey) {
    console.error('❌ Wasender API key not configured')
    console.error('   Missing: WASENDER_API_KEY')
    return false
  }

  try {
    const cleanPhone = to.replace(/\s+/g, '') // Remove spaces from phone number
    console.log(`📤 Sending WhatsApp via wasenderapi to: ${cleanPhone}`)
    
    const response = await fetch('https://wasenderapi.com/api/send-message', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: cleanPhone,
        text: body
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ Wasender API error:', {
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
    console.error('❌ Error calling Wasender API:', error)
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
 * Handles formats: 04, 4, +614, 0614, 614, +61, etc.
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return ''
  
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '')
  
  // Remove + to work with just digits
  cleaned = cleaned.replace(/\+/g, '')
  
  // If starts with 614, it's already correct format (just needs +)
  if (cleaned.startsWith('614')) {
    return '+' + cleaned
  }
  
  // If starts with 61 but not 614, it might be +61 4... → +614...
  if (cleaned.startsWith('61')) {
    return '+' + cleaned
  }
  
  // If starts with 04, 05, 06, 07, 08, 09 → remove 0 and add 61
  if (cleaned.startsWith('0') && cleaned.length >= 10) {
    cleaned = cleaned.substring(1) // Remove leading 0
    return '+61' + cleaned
  }
  
  // If starts with 4, 5, 6, 7, 8, 9 and doesn't have country code → add 61
  if (/^[4-9]/.test(cleaned) && cleaned.length >= 9) {
    return '+61' + cleaned
  }
  
  // Default: assume it needs +61
  return '+61' + cleaned
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

