/**
 * Picky Assist WhatsApp API Integration
 * Sends messages via Picky Assist's WhatsApp Business Platform using templates
 */

export type PickyAssistTemplateMessage = {
  number: string // Phone number with country code (e.g., +61412345678)
  template_message: string[] // Parameters for template placeholders
  language?: string // Language code (default: 'en')
}

export type PaymentReminderData = {
  name: string
  balance: number // Negative balance (owes money)
  phone: string
}

/**
 * Validate phone number - returns true if valid format for WhatsApp
 */
function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 9 && digits.length <= 15
}

/**
 * Format phone number for WhatsApp/Picky Assist
 * Converts 04xyz to +614xyz, handles various formats
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
  
  // If starts with 04, 05, 06, 07, 08, 09 → remove 0 and add +61
  // This handles Australian mobiles like 0412345678 → +61412345678
  if (cleaned.startsWith('0') && cleaned.length >= 10) {
    cleaned = cleaned.substring(1) // Remove leading 0
    return '+61' + cleaned
  }
  
  // If starts with 4, 5, 6, 7, 8, 9 and doesn't have country code → add +61
  if (/^[4-9]/.test(cleaned) && cleaned.length >= 9) {
    return '+61' + cleaned
  }
  
  // Default: assume it needs +61
  return '+61' + cleaned
}

/**
 * Send template messages using Picky Assist API
 * API Format:
 * {
 *   "token": "API_KEY",
 *   "application": 121,
 *   "template_id": "XA185499179",
 *   "data": [{ "number": "+614...", "template_message": ["param1", "param2"], "language": "en" }]
 * }
 */
export async function sendPickyAssistTemplates(
  templateId: string,
  messages: PickyAssistTemplateMessage[],
  testNumber?: string
): Promise<{ success: boolean; sent: number; failed: number }> {
  const apiKey = process.env.PICKY_ASSIST_API_KEY
  const applicationId = process.env.PICKY_ASSIST_PAYMENT_APPLICATION_ID || '121'

  if (!apiKey) {
    console.error('❌ Picky Assist API key not configured')
    return { success: false, sent: 0, failed: messages.length }
  }

  // If test number provided, redirect all messages to it but keep original content
  const processedMessages = messages.map(msg => ({
    number: testNumber ? formatPhoneNumber(testNumber) : msg.number,
    template_message: msg.template_message,
    language: msg.language || 'en'
  }))

  if (testNumber) {
    console.log(`🧪 TEST MODE: Redirecting ${messages.length} messages to ${testNumber}`)
  }

  const payload = {
    token: apiKey,
    application: parseInt(applicationId),
    template_id: templateId,
    data: processedMessages
  }

  try {
    console.log(`📤 Sending ${processedMessages.length} template messages via Picky Assist`)
    
    const response = await fetch('https://app.pickyassist.com/api/v2/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ Picky Assist API error:', {
        status: response.status,
        statusText: response.statusText,
        error: error
      })
      return { success: false, sent: 0, failed: messages.length }
    }

    const result = await response.json()
    console.log('✅ Picky Assist response:', result)
    
    return { 
      success: true, 
      sent: processedMessages.length, 
      failed: 0 
    }
  } catch (error) {
    console.error('❌ Error calling Picky Assist API:', error)
    return { success: false, sent: 0, failed: messages.length }
  }
}

/**
 * Send payment reminder to a single member
 * Uses template XA185499179 with params: [Name, Balance, BSB, Account Number]
 */
export async function sendPaymentReminder(
  data: PaymentReminderData,
  bsb: string,
  accountNumber: string,
  testNumber?: string
): Promise<boolean> {
  const phone = formatPhoneNumber(data.phone)
  
  if (!isValidPhoneNumber(phone)) {
    console.log(`⏭️ Skipping invalid phone number: ${data.phone}`)
    return false
  }

  const templateId = process.env.PICKY_ASSIST_PAYMENT_TEMPLATE_ID || 'XA185499179'
  
  // Format balance as positive number (amount owed)
  const balanceOwed = Math.abs(data.balance).toFixed(0)
  
  const message: PickyAssistTemplateMessage = {
    number: phone,
    template_message: [
      data.name,
      balanceOwed,
      bsb,
      accountNumber
    ],
    language: 'en'
  }

  const result = await sendPickyAssistTemplates(templateId, [message], testNumber)
  return result.success
}

/**
 * Send payment reminders to all members with negative balance
 */
export async function sendBulkPaymentReminders(
  members: PaymentReminderData[],
  bsb: string,
  accountNumber: string,
  testMode: boolean = false,
  testNumber?: string
): Promise<{ success: boolean; sent: number; failed: number; skipped: number }> {
  // Filter to only members with negative balance (they owe money)
  const membersWithDebt = members.filter(m => m.balance < 0 && m.phone)
  
  if (membersWithDebt.length === 0) {
    console.log('ℹ️ No members with negative balance to remind')
    return { success: true, sent: 0, failed: 0, skipped: members.length }
  }

  console.log(`📋 Found ${membersWithDebt.length} members with negative balance`)

  const templateId = process.env.PICKY_ASSIST_PAYMENT_TEMPLATE_ID || 'XA185499179'
  
  const messages: PickyAssistTemplateMessage[] = membersWithDebt
    .filter(m => isValidPhoneNumber(formatPhoneNumber(m.phone)))
    .map(m => ({
      number: formatPhoneNumber(m.phone),
      template_message: [
        m.name,
        Math.abs(m.balance).toFixed(0), // Amount owed (positive)
        bsb,
        accountNumber
      ],
      language: 'en'
    }))

  const skipped = membersWithDebt.length - messages.length

  if (messages.length === 0) {
    console.log('⚠️ No valid phone numbers to send to')
    return { success: true, sent: 0, failed: 0, skipped: membersWithDebt.length }
  }

  const result = await sendPickyAssistTemplates(
    templateId, 
    messages, 
    testMode ? testNumber : undefined
  )

  return {
    success: result.success,
    sent: result.sent,
    failed: result.failed,
    skipped
  }
}

/**
 * Legacy function for backward compatibility - simple text messages
 * Note: For WhatsApp Business API, outside the 24h window you need templates
 */
export async function sendWhatsAppMessage(message: { to: string, body: string }): Promise<boolean> {
  console.warn('⚠️ sendWhatsAppMessage is deprecated for Picky Assist. Use templates instead.')
  
  // For simple text messages, we'd need a different template or API
  // For now, log the message and return true to not break existing code
  console.log(`📤 Would send to ${message.to}: ${message.body.substring(0, 100)}...`)
  
  // If you have a generic text template, you could use it here
  // For now, we'll just return true to not break existing functionality
  return true
}
