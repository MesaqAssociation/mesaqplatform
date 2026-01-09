/**
 * Mobile Message SMS API Integration
 * Sends SMS messages via Mobile Message's API
 * 
 * API Documentation: https://mobilemessage.com.au/api-documentation
 * 
 * Each message costs 2 credits
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
    
    // The account endpoint returns credits in a "credits" or "balance" field
    return { 
      credits: data.credits || data.balance || data.credit || 0, 
      success: true 
    }
  } catch (error) {
    console.error('❌ Error checking Mobile Message balance:', error)
    return { credits: 0, success: false }
  }
}

/**
 * Send a single SMS message
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

  try {
    // Mobile Message API expects the phone number and message
    const response = await fetch('https://api.mobilemessage.com.au/v1/sms', {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: phone,
        message: message,
        // Sender ID is optional - Mobile Message will use default if not provided
        // from: process.env.MOBILE_MESSAGE_SENDER || undefined
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Mobile Message send failed:`, {
        status: response.status,
        error: errorText
      })
      return { success: false, error: errorText }
    }

    const data = await response.json()
    console.log(`✅ SMS sent to ${phone}:`, data)
    
    return { 
      success: true, 
      messageId: data.messageId || data.id || data.message_id
    }
  } catch (error: any) {
    console.error('❌ Error sending SMS:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send bulk SMS messages (one by one, no delay)
 */
export async function sendBulkSMS(
  messages: SMSMessage[]
): Promise<{ success: boolean; sent: number; failed: number; skipped: number }> {
  if (messages.length === 0) {
    return { success: true, sent: 0, failed: 0, skipped: 0 }
  }

  console.log(`📤 Sending ${messages.length} SMS messages via Mobile Message`)

  let sent = 0
  let failed = 0
  let skipped = 0

  // Send all messages without delay
  const results = await Promise.all(
    messages.map(async (msg) => {
      const phone = formatPhoneNumber(msg.to)
      if (!isValidPhoneNumber(phone)) {
        skipped++
        return { success: false, skipped: true }
      }

      const result = await sendSMS(msg.to, msg.message)
      if (result.success) {
        sent++
      } else {
        failed++
      }
      return result
    })
  )

  console.log(`✅ Bulk SMS: ${sent} sent, ${failed} failed, ${skipped} skipped`)

  return {
    success: failed === 0,
    sent,
    failed,
    skipped
  }
}

/**
 * Calculate credit cost for sending messages
 * Each message costs 2 credits
 */
export function calculateCreditCost(messageCount: number): number {
  return messageCount * 2
}

/**
 * Check if we have enough credits to send messages
 */
export async function hasEnoughCredits(messageCount: number): Promise<{ 
  hasEnough: boolean; 
  currentCredits: number; 
  requiredCredits: number 
}> {
  const { credits } = await getBalance()
  const requiredCredits = calculateCreditCost(messageCount)
  
  return {
    hasEnough: credits >= requiredCredits,
    currentCredits: credits,
    requiredCredits
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

