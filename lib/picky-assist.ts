/**
 * Picky Assist WhatsApp API Integration
 * Sends messages via Picky Assist's WhatsApp Business Platform using templates
 * 
 * Template Types:
 * 1. Payment Reminders (PICKY_ASSIST_PAYMENT_TEMPLATE_ID)
 *    Placeholders: {{1}} Name, {{2}} Balance, {{3}} BSB, {{4}} Account Number, {{5-8}} duplicates for Arabic
 * 
 * 2. Event Notifications (PICKY_ASSIST_EVENT_TEMPLATE_ID)
 *    Placeholders: {{1}} Name, {{2}} Event Name - Date, {{3}} Group, {{4}} Other group members, {{5-8}} duplicates
 * 
 * 3. Admin Messages (PICKY_ASSIST_ADMIN_MESSAGE_TEMPLATE_ID)
 *    Placeholders: {{1}} Name, {{2}} Admin message
 *    Note: Messages come prefilled with "Salam {{name}}" and end with "Kind Regards - Mesaq"
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

export type EventNotificationData = {
  memberName: string
  eventName: string
  eventDate: string
  groupName: string
  otherGroupMembers: string // Comma-separated list of other member names
  phone: string
}

export type AdminMessageData = {
  memberName: string
  message: string
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
 * Check if test mode is enabled
 * Test mode can be enabled by:
 * - PICKY_ASSIST_TEST_MODE=true
 * - PICKY_ASSIST_TEST_MODE=1
 * - PICKY_ASSIST_TEST_MODE=yes
 */
function isTestMode(): boolean {
  const testMode = process.env.PICKY_ASSIST_TEST_MODE?.toLowerCase()
  return testMode === 'true' || testMode === '1' || testMode === 'yes'
}

/**
 * Get the test number - ALWAYS returns test number if test mode is enabled
 * This ensures ALL messages go to test number when in test mode
 */
function getTestNumber(): string | undefined {
  const testNumber = process.env.WHATSAPP_TEST_NUMBER
  if (isTestMode() && testNumber) {
    console.log(`🧪 TEST MODE ACTIVE - All messages will be sent to: ${testNumber}`)
    return testNumber
  }
  return undefined
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
  const applicationId = process.env.PICKY_ASSIST_APPLICATION_ID || '121'

  if (!apiKey) {
    console.error('❌ Picky Assist API key not configured')
    return { success: false, sent: 0, failed: messages.length }
  }

  // CRITICAL: Check if we're in test mode FIRST - always override with test number
  // This ensures ALL messages go to test number when PICKY_ASSIST_TEST_MODE is enabled
  const globalTestNumber = getTestNumber() // This checks PICKY_ASSIST_TEST_MODE
  const effectiveTestNumber = globalTestNumber || testNumber // Global takes priority
  
  if (isTestMode()) {
    console.log(`🧪 ==========================================`)
    console.log(`🧪 TEST MODE IS ENABLED!`)
    console.log(`🧪 All ${messages.length} messages will go to: ${effectiveTestNumber}`)
    console.log(`🧪 Original recipients will NOT receive messages`)
    console.log(`🧪 ==========================================`)
  }

  // If test number is set (either globally or passed), redirect ALL messages to it
  const processedMessages = messages.map(msg => ({
    number: effectiveTestNumber ? formatPhoneNumber(effectiveTestNumber) : msg.number,
    template_message: msg.template_message,
    language: msg.language || 'en'
  }))

  const payload = {
    token: apiKey,
    application: parseInt(applicationId),
    template_id: templateId,
    data: processedMessages
  }

  try {
    console.log(`📤 Sending ${processedMessages.length} template messages via Picky Assist`)
    console.log(`   Template: ${templateId}, Application: ${applicationId}`)
    
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
 * Template placeholders:
 * {{1}} - Name
 * {{2}} - Balance (no $ sign)
 * {{3}} - BSB (Main account)
 * {{4}} - Account number (Main account)
 * {{5-8}} - Same as above (for Arabic duplicate)
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
  
  // Format balance as positive number (amount owed) - NO $ sign
  const balanceOwed = Math.abs(data.balance).toFixed(0)
  
  const message: PickyAssistTemplateMessage = {
    number: phone,
    template_message: [
      data.name,           // {{1}} - Name
      balanceOwed,         // {{2}} - Balance (no $ sign)
      bsb,                 // {{3}} - BSB
      accountNumber,       // {{4}} - Account number
      data.name,           // {{5}} - Name (Arabic)
      balanceOwed,         // {{6}} - Balance (Arabic)
      bsb,                 // {{7}} - BSB (Arabic)
      accountNumber        // {{8}} - Account number (Arabic)
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
        m.name,                              // {{1}} - Name
        Math.abs(m.balance).toFixed(0),      // {{2}} - Balance (no $ sign)
        bsb,                                 // {{3}} - BSB
        accountNumber,                       // {{4}} - Account number
        m.name,                              // {{5}} - Name (Arabic)
        Math.abs(m.balance).toFixed(0),      // {{6}} - Balance (Arabic)
        bsb,                                 // {{7}} - BSB (Arabic)
        accountNumber                        // {{8}} - Account number (Arabic)
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
 * Send event notification to group members
 * Template placeholders:
 * {{1}} - Name
 * {{2}} - Name of event - (date) e.g. "Eid Celebration - January 15, 2025"
 * {{3}} - Group, e.g. "Group 1"
 * {{4}} - All other group members e.g. "Mark, Smith, James"
 * {{5-8}} - Same as above (for Arabic duplicate)
 */
export async function sendEventNotification(
  data: EventNotificationData,
  testNumber?: string
): Promise<boolean> {
  const phone = formatPhoneNumber(data.phone)
  
  if (!isValidPhoneNumber(phone)) {
    console.log(`⏭️ Skipping invalid phone number: ${data.phone}`)
    return false
  }

  const templateId = process.env.PICKY_ASSIST_EVENT_TEMPLATE_ID
  
  if (!templateId) {
    console.error('❌ PICKY_ASSIST_EVENT_TEMPLATE_ID not configured')
    return false
  }
  
  // Format event with date: "Event Name - Date"
  const eventWithDate = `${data.eventName} - ${data.eventDate}`
  
  const message: PickyAssistTemplateMessage = {
    number: phone,
    template_message: [
      data.memberName,        // {{1}} - Name
      eventWithDate,          // {{2}} - Event name - date
      data.groupName,         // {{3}} - Group name
      data.otherGroupMembers, // {{4}} - Other group members
      data.memberName,        // {{5}} - Name (Arabic)
      eventWithDate,          // {{6}} - Event name - date (Arabic)
      data.groupName,         // {{7}} - Group name (Arabic)
      data.otherGroupMembers  // {{8}} - Other group members (Arabic)
    ],
    language: 'en'
  }

  const result = await sendPickyAssistTemplates(templateId, [message], testNumber)
  return result.success
}

/**
 * Send bulk event notifications to group members
 */
export async function sendBulkEventNotifications(
  members: EventNotificationData[],
  testMode: boolean = false,
  testNumber?: string
): Promise<{ success: boolean; sent: number; failed: number; skipped: number }> {
  const templateId = process.env.PICKY_ASSIST_EVENT_TEMPLATE_ID
  
  if (!templateId) {
    console.error('❌ PICKY_ASSIST_EVENT_TEMPLATE_ID not configured')
    return { success: false, sent: 0, failed: members.length, skipped: 0 }
  }

  const validMembers = members.filter(m => isValidPhoneNumber(formatPhoneNumber(m.phone)))
  const skipped = members.length - validMembers.length

  if (validMembers.length === 0) {
    console.log('⚠️ No valid phone numbers to send to')
    return { success: true, sent: 0, failed: 0, skipped: members.length }
  }

  const messages: PickyAssistTemplateMessage[] = validMembers.map(m => {
    const eventWithDate = `${m.eventName} - ${m.eventDate}`
    return {
      number: formatPhoneNumber(m.phone),
      template_message: [
        m.memberName,        // {{1}} - Name
        eventWithDate,       // {{2}} - Event name - date
        m.groupName,         // {{3}} - Group name
        m.otherGroupMembers, // {{4}} - Other group members
        m.memberName,        // {{5}} - Name (Arabic)
        eventWithDate,       // {{6}} - Event name - date (Arabic)
        m.groupName,         // {{7}} - Group name (Arabic)
        m.otherGroupMembers  // {{8}} - Other group members (Arabic)
      ],
      language: 'en'
    }
  })

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
 * Send admin message to a member
 * Template placeholders:
 * {{1}} - Name of member
 * {{2}} - Admin message
 * 
 * Note: The message comes prefilled with "Salam {{name}}" and ends with "Kind Regards - Mesaq"
 */
export async function sendAdminMessage(
  data: AdminMessageData,
  testNumber?: string
): Promise<boolean> {
  const phone = formatPhoneNumber(data.phone)
  
  if (!isValidPhoneNumber(phone)) {
    console.log(`⏭️ Skipping invalid phone number: ${data.phone}`)
    return false
  }

  const templateId = process.env.PICKY_ASSIST_ADMIN_MESSAGE_TEMPLATE_ID
  
  if (!templateId) {
    console.error('❌ PICKY_ASSIST_ADMIN_MESSAGE_TEMPLATE_ID not configured')
    return false
  }
  
  const message: PickyAssistTemplateMessage = {
    number: phone,
    template_message: [
      data.memberName,  // {{1}} - Name
      data.message      // {{2}} - Admin message
    ],
    language: 'en'
  }

  const result = await sendPickyAssistTemplates(templateId, [message], testNumber)
  return result.success
}

/**
 * Send bulk admin messages to members
 */
export async function sendBulkAdminMessages(
  members: AdminMessageData[],
  testMode: boolean = false,
  testNumber?: string
): Promise<{ success: boolean; sent: number; failed: number; skipped: number }> {
  const templateId = process.env.PICKY_ASSIST_ADMIN_MESSAGE_TEMPLATE_ID
  
  if (!templateId) {
    console.error('❌ PICKY_ASSIST_ADMIN_MESSAGE_TEMPLATE_ID not configured')
    return { success: false, sent: 0, failed: members.length, skipped: 0 }
  }

  const validMembers = members.filter(m => isValidPhoneNumber(formatPhoneNumber(m.phone)))
  const skipped = members.length - validMembers.length

  if (validMembers.length === 0) {
    console.log('⚠️ No valid phone numbers to send to')
    return { success: true, sent: 0, failed: 0, skipped: members.length }
  }

  const messages: PickyAssistTemplateMessage[] = validMembers.map(m => ({
    number: formatPhoneNumber(m.phone),
    template_message: [
      m.memberName,  // {{1}} - Name
      m.message      // {{2}} - Admin message
    ],
    language: 'en'
  }))

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
