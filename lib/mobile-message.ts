/**
 * Mobile Message SMS API Integration
 * Sends SMS messages via Mobile Message's API
 * 
 * API Documentation: https://mobilemessage.com.au/api-documentation
 * 
 * Required Environment Variables:
 * - MOBILE_MESSAGE_USERNAME: API username from Mobile Message
 * - MOBILE_MESSAGE_PASSWORD: API password from Mobile Message
 * - MOBILE_MESSAGE_SENDER_ID: Approved sender ID (check your Mobile Message dashboard)
 * 
 * API Endpoints:
 * - GET /v1/account - Check balance (returns credit_balance)
 * - POST /v1/messages - Send SMS (requires messages array with to, message, sender)
 * 
 * Each message costs 1 credit
 */

export type SMSMessage = {
  to: string // Phone number with country code (e.g., 61412345678)
  message: string
}

/**
 * Validate phone number - returns true if valid format for SMS
 */
function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 9 && digits.length <= 15
}

/**
 * Format phone number for Mobile Message API
 * Converts 04xyz to 614xyz, handles various formats
 * Returns number WITHOUT the + prefix (Mobile Message wants just digits)
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return ''
  
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '')
  
  // If starts with 614, it's already correct format
  if (cleaned.startsWith('614')) {
    return cleaned
  }
  
  // If starts with 61 but not 614, it might be 61 4... → 614...
  if (cleaned.startsWith('61')) {
    return cleaned
  }
  
  // If starts with 04, 05, 06, 07, 08, 09 → remove 0 and add 61
  // This handles Australian mobiles like 0412345678 → 61412345678
  if (cleaned.startsWith('0') && cleaned.length >= 10) {
    cleaned = cleaned.substring(1) // Remove leading 0
    return '61' + cleaned
  }
  
  // If starts with 4, 5, 6, 7, 8, 9 and doesn't have country code → add 61
  if (/^[4-9]/.test(cleaned) && cleaned.length >= 9) {
    return '61' + cleaned
  }
  
  // Default: assume it needs 61
  return '61' + cleaned
}

/**
 * Get Basic Auth header for Mobile Message API
 */
function getAuthHeader(): string {
  const username = process.env.MOBILE_MESSAGE_USERNAME
  const password = process.env.MOBILE_MESSAGE_PASSWORD
  
  if (!username || !password) {
    throw new Error('Mobile Message credentials not configured')
  }
  
  const credentials = Buffer.from(`${username}:${password}`).toString('base64')
  return `Basic ${credentials}`
}

/**
 * Get account balance from Mobile Message
 * Returns balance in credits
 */
export async function getBalance(): Promise<{ credits: number; success: boolean }> {
  try {
    const response = await fetch('https://api.mobilemessage.com.au/v1/account', {
      method: 'GET',
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json',
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Mobile Message balance check failed:', response.status, errorText)
      return { credits: 0, success: false }
    }

    const data = await response.json()
    console.log('✅ Mobile Message account info:', data)
    
    // The account endpoint returns credits in "credit_balance" field
    const credits = data.credit_balance ?? data.credits ?? data.balance ?? 0
    return { credits, success: true }
  } catch (error) {
    console.error('❌ Error checking Mobile Message balance:', error)
    return { credits: 0, success: false }
  }
}

/**
 * Send a single SMS message
 * Uses the /v1/messages endpoint with messages array format
 */
export async function sendSMS(
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const phone = formatPhoneNumber(to)
  
  if (!isValidPhoneNumber(phone)) {
    console.log(`⏭️ Skipping invalid phone number: ${to}`)
    return { success: false, error: 'Invalid phone number' }
  }

  // Sender ID must be configured in Mobile Message dashboard
  const sender = process.env.MOBILE_MESSAGE_SENDER_ID
  if (!sender) {
    console.error('❌ MOBILE_MESSAGE_SENDER_ID not configured')
    return { success: false, error: 'Sender ID not configured' }
  }

  try {
    // Mobile Message API: POST /v1/messages with messages array
    const response = await fetch('https://api.mobilemessage.com.au/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{
          to: phone,
          message: message,
          sender: sender
        }]
      })
    })

    const data = await response.json()
    console.log(`📤 Mobile Message response for ${phone}:`, JSON.stringify(data))
    
    // Check the result for the first message
    const result = data.results?.[0]
    if (result?.status === 'error') {
      console.error(`❌ SMS failed to ${phone}:`, result.error)
      return { success: false, error: result.error }
    }
    
    if (result?.status === 'queued' || result?.status === 'sent' || result?.status === 'success') {
      console.log(`✅ SMS sent to ${phone}`)
      return { 
        success: true, 
        messageId: result.message_id || result.id
      }
    }

    // Unknown status
    console.warn(`⚠️ Unknown SMS status for ${phone}:`, result)
    return { success: false, error: 'Unknown response status' }
  } catch (error: any) {
    console.error('❌ Error sending SMS:', error)
    return { success: false, error: error.message }
  }
}

export type BulkSMSResult = {
  success: boolean
  sent: number
  failed: number
  skipped: number
  totalCost: number
  results: Array<{
    to: string
    messageId?: string
    status: 'sent' | 'failed' | 'skipped'
    error?: string
  }>
}

/**
 * Send bulk SMS messages in a single API call
 * The API supports sending multiple messages at once
 * Returns detailed results including message IDs for tracking
 */
export async function sendBulkSMS(
  messages: SMSMessage[]
): Promise<BulkSMSResult> {
  if (messages.length === 0) {
    return { success: true, sent: 0, failed: 0, skipped: 0, totalCost: 0, results: [] }
  }

  const sender = process.env.MOBILE_MESSAGE_SENDER_ID
  if (!sender) {
    console.error('❌ MOBILE_MESSAGE_SENDER_ID not configured')
    return { 
      success: false, 
      sent: 0, 
      failed: messages.length, 
      skipped: 0, 
      totalCost: 0,
      results: messages.map(m => ({ to: m.to, status: 'failed' as const, error: 'Sender ID not configured' }))
    }
  }

  console.log(`📤 Sending ${messages.length} SMS messages via Mobile Message`)

  // Prepare messages array, filtering out invalid phone numbers
  const validMessages: { to: string; message: string; sender: string; originalIndex: number }[] = []
  const results: BulkSMSResult['results'] = []
  let skipped = 0

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const phone = formatPhoneNumber(msg.to)
    if (!isValidPhoneNumber(phone)) {
      console.log(`⏭️ Skipping invalid phone: ${msg.to}`)
      skipped++
      results.push({ to: msg.to, status: 'skipped', error: 'Invalid phone number' })
      continue
    }
    validMessages.push({
      to: phone,
      message: msg.message,
      sender: sender,
      originalIndex: i
    })
  }

  if (validMessages.length === 0) {
    return { success: true, sent: 0, failed: 0, skipped, totalCost: 0, results }
  }

  try {
    // Send all messages in one API call
    const response = await fetch('https://api.mobilemessage.com.au/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        messages: validMessages.map(m => ({ to: m.to, message: m.message, sender: m.sender }))
      })
    })

    const data = await response.json()
    console.log('📤 Bulk SMS response:', JSON.stringify(data).substring(0, 1000))

    // Count results and extract message IDs
    let sent = 0
    let failed = 0
    let totalCost = data.total_cost || 0

    if (data.results && Array.isArray(data.results)) {
      for (let i = 0; i < data.results.length; i++) {
        const result = data.results[i]
        if (result.status === 'queued' || result.status === 'sent' || result.status === 'success') {
          sent++
          results.push({ 
            to: result.to, 
            messageId: result.message_id,
            status: 'sent'
          })
        } else {
          failed++
          console.log(`❌ Failed to send to ${result.to}: ${result.error || result.status}`)
          results.push({ 
            to: result.to, 
            status: 'failed',
            error: result.error || result.status
          })
        }
      }
    }

    console.log(`✅ Bulk SMS: ${sent} sent, ${failed} failed, ${skipped} skipped, cost: ${totalCost}`)

    return {
      success: failed === 0,
      sent,
      failed,
      skipped,
      totalCost,
      results
    }
  } catch (error: any) {
    console.error('❌ Error sending bulk SMS:', error)
    return { 
      success: false, 
      sent: 0, 
      failed: messages.length - skipped, 
      skipped, 
      totalCost: 0,
      results: validMessages.map(m => ({ to: m.to, status: 'failed' as const, error: error.message }))
    }
  }
}

/**
 * Calculate SMS parts based on message length
 * - GSM-7: 160 chars for 1 part, 153 for subsequent parts
 * - Unicode: 70 chars for 1 part, 67 for subsequent parts
 */
export function calculateMessageParts(message: string): number {
  if (!message) return 1
  
  // Check if message contains non-GSM characters (requires Unicode)
  const isUnicode = /[^\x00-\x7F]/.test(message)
  
  const length = message.length
  
  if (isUnicode) {
    // Unicode: 70 chars first part, 67 subsequent
    if (length <= 70) return 1
    return Math.ceil(length / 67)
  } else {
    // GSM-7: 160 chars first part, 153 subsequent
    if (length <= 160) return 1
    return Math.ceil(length / 153)
  }
}

/**
 * Calculate credit cost for a single message based on its length
 * Cost = number of message parts (1 credit per part)
 */
export function calculateMessageCost(message: string): number {
  return calculateMessageParts(message)
}

/**
 * Calculate total credit cost for multiple messages
 */
export function calculateTotalCreditCost(messages: { message: string }[]): number {
  return messages.reduce((total, msg) => total + calculateMessageParts(msg.message), 0)
}

/**
 * Check if we have enough credits to send messages
 * @param messages - Array of message objects with message content
 */
export async function hasEnoughCredits(messages: { message: string }[]): Promise<{ 
  hasEnough: boolean; 
  currentCredits: number; 
  requiredCredits: number 
}> {
  const { credits } = await getBalance()
  const requiredCredits = calculateTotalCreditCost(messages)
  
  return {
    hasEnough: credits >= requiredCredits,
    currentCredits: credits,
    requiredCredits
  }
}

/**
 * Quick check for estimated credits (assumes 1 part per message)
 */
export async function hasEnoughCreditsSimple(messageCount: number): Promise<{ 
  hasEnough: boolean; 
  currentCredits: number; 
  requiredCredits: number 
}> {
  const { credits } = await getBalance()
  return {
    hasEnough: credits >= messageCount,
    currentCredits: credits,
    requiredCredits: messageCount
  }
}

// ===========================================
// Message Builder Functions (English only)
// ===========================================

/**
 * Build admin/general message content
 */
export function buildAdminMessage(memberName: string, message: string): string {
  return `Salam ${memberName},\n\n${message}\n\nKind Regards - Mesaq Association`
}

/**
 * Build payment reminder message content
 */
export function buildPaymentReminderMessage(
  name: string,
  balanceOwed: number,
  bsb: string,
  accountNumber: string
): string {
  return `Salam ${name},

You are currently $${balanceOwed} behind on your Mesaq Community Membership.

Please pay ASAP with your phone number in the description to:
BSB: ${bsb}
Account Number: ${accountNumber}

Kind Regards - Mesaq Association`
}

/**
 * Build event notification message content
 */
export function buildEventNotificationMessage(
  memberName: string,
  eventTitle: string,
  eventDate: string,
  groupName: string,
  otherMembers: string
): string {
  return `Salam ${memberName},

A new event has been created: ${eventTitle} - ${eventDate}.

You're receiving this message because you're a member of ${groupName}, the group responsible for managing this event.

Other group members: ${otherMembers}

Please coordinate with them.

Kind Regards - Mesaq Association`
}

