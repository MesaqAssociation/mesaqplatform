/**
 * Picky Assist WhatsApp API Integration
 * Sends messages via Picky Assist's WhatsApp Business Platform using templates
 */

export type PickyAssistMessage = {
  to: string // Phone number with country code (e.g., +61412345678)
  templateName: string // Name of the approved WhatsApp template
  templateParams?: string[] // Parameters to fill in the template placeholders
  language?: string // Language code (default: 'en')
}

export type PickyAssistTextMessage = {
  to: string
  body: string
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
 * Format phone number for WhatsApp (ensure + and country code)
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return ''
  
  let cleaned = phone.replace(/[^\d+]/g, '')
  cleaned = cleaned.replace(/\+/g, '')
  
  if (cleaned.startsWith('614')) {
    return '+' + cleaned
  }
  
  if (cleaned.startsWith('61')) {
    return '+' + cleaned
  }
  
  if (cleaned.startsWith('0') && cleaned.length >= 10) {
    cleaned = cleaned.substring(1)
    return '+61' + cleaned
  }
  
  if (/^[4-9]/.test(cleaned) && cleaned.length >= 9) {
    return '+61' + cleaned
  }
  
  return '+61' + cleaned
}

/**
 * Send a WhatsApp message using Picky Assist Template API
 */
export async function sendPickyAssistTemplate(message: PickyAssistMessage): Promise<boolean> {
  try {
    const { to, templateName, templateParams = [], language = 'en' } = message
    const testNumber = process.env.WHATSAPP_TEST_NUMBER

    if (!isValidPhoneNumber(to)) {
      console.log(`⏭️ Skipping invalid phone number: ${to}`)
      return true
    }

    const targetNumber = testNumber || to
    if (testNumber) {
      console.log(`🧪 TEST MODE: Redirecting message for ${to} to test number ${testNumber}`)
    }

    const apiKey = process.env.PICKY_ASSIST_API_KEY
    const projectId = process.env.PICKY_ASSIST_PROJECT_ID
    const botId = process.env.PICKY_ASSIST_BOT_ID

    if (!apiKey || !projectId) {
      console.error('❌ Picky Assist not configured')
      console.error('   Missing: PICKY_ASSIST_API_KEY or PICKY_ASSIST_PROJECT_ID')
      return false
    }

    const cleanPhone = targetNumber.replace(/\s+/g, '').replace('+', '')
    console.log(`📤 Sending WhatsApp template via Picky Assist to: ${cleanPhone}`)
    
    // Picky Assist API endpoint for template messages
    const endpoint = `https://app.pickyassist.com/app/api/v2/push/template`
    
    const payload = {
      project_id: projectId,
      bot_id: botId,
      phone: cleanPhone,
      template: templateName,
      language: language,
      parameters: templateParams
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
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
      return false
    }

    const result = await response.json()
    console.log(`✅ WhatsApp template sent to ${to}`, result)
    return true
  } catch (error) {
    console.error('❌ Error calling Picky Assist API:', error)
    return false
  }
}

/**
 * Send a simple text message using Picky Assist
 * Note: For WhatsApp Business API, text messages can only be sent within 24h of customer interaction
 */
export async function sendPickyAssistText(message: PickyAssistTextMessage): Promise<boolean> {
  try {
    const { to, body } = message
    const testNumber = process.env.WHATSAPP_TEST_NUMBER

    if (!isValidPhoneNumber(to)) {
      console.log(`⏭️ Skipping invalid phone number: ${to}`)
      return true
    }

    const targetNumber = testNumber || to
    if (testNumber) {
      console.log(`🧪 TEST MODE: Redirecting message for ${to} to test number ${testNumber}`)
    }

    const apiKey = process.env.PICKY_ASSIST_API_KEY
    const projectId = process.env.PICKY_ASSIST_PROJECT_ID
    const botId = process.env.PICKY_ASSIST_BOT_ID

    if (!apiKey || !projectId) {
      console.error('❌ Picky Assist not configured')
      return false
    }

    const cleanPhone = targetNumber.replace(/\s+/g, '').replace('+', '')
    console.log(`📤 Sending WhatsApp text via Picky Assist to: ${cleanPhone}`)
    
    const endpoint = `https://app.pickyassist.com/app/api/v2/push`
    
    const payload = {
      project_id: projectId,
      bot_id: botId,
      phone: cleanPhone,
      message: body
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
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
      return false
    }

    const result = await response.json()
    console.log(`✅ WhatsApp text sent to ${to}`, result)
    return true
  } catch (error) {
    console.error('❌ Error calling Picky Assist API:', error)
    return false
  }
}

/**
 * Fetch incoming messages from Picky Assist
 * This retrieves recent messages received by your WhatsApp number
 */
export async function getIncomingMessages(limit: number = 50): Promise<any[]> {
  try {
    const apiKey = process.env.PICKY_ASSIST_API_KEY
    const projectId = process.env.PICKY_ASSIST_PROJECT_ID

    if (!apiKey || !projectId) {
      console.error('❌ Picky Assist not configured')
      return []
    }

    const endpoint = `https://app.pickyassist.com/app/api/v2/messages?project_id=${projectId}&limit=${limit}&direction=inbound`
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      }
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ Failed to fetch incoming messages:', error)
      return []
    }

    const result = await response.json()
    return result.messages || result.data || []
  } catch (error) {
    console.error('❌ Error fetching incoming messages:', error)
    return []
  }
}

// Legacy function for backward compatibility
export async function sendWhatsAppMessage(message: { to: string, body: string }): Promise<boolean> {
  // Use text message API for simple messages
  return sendPickyAssistText({
    to: message.to,
    body: message.body
  })
}

