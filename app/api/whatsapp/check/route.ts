import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

/**
 * Diagnostic endpoint to check WhatsApp configuration
 * Shows which environment variables are set (without exposing values)
 */
export async function GET(req: NextRequest) {
  // Verify user is authenticated as admin/board
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as any
    if (decoded.role !== 'board' && decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check which environment variables are configured
  const config = {
    whatsapp: {
      apiUrl: {
        set: !!process.env.WHATSAPP_API_URL,
        value: process.env.WHATSAPP_API_URL ? '✓ Set' : '✗ Not set',
        default: 'https://graph.facebook.com/v18.0'
      },
      phoneNumberId: {
        set: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
        value: process.env.WHATSAPP_PHONE_NUMBER_ID ? `✓ Set (${process.env.WHATSAPP_PHONE_NUMBER_ID.substring(0, 4)}...)` : '✗ Not set',
        required: true
      },
      accessToken: {
        set: !!process.env.WHATSAPP_ACCESS_TOKEN,
        value: process.env.WHATSAPP_ACCESS_TOKEN ? `✓ Set (${process.env.WHATSAPP_ACCESS_TOKEN.length} chars)` : '✗ Not set',
        required: true
      },
      businessAccountId: {
        set: !!process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
        value: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ? '✓ Set' : '✗ Not set',
        required: false
      }
    },
    board: {
      groupId: {
        set: !!process.env.WHATSAPP_BOARD_GROUP_ID,
        value: process.env.WHATSAPP_BOARD_GROUP_ID || '✗ Not set',
        required: false
      }
    }
  }

  // Check if all required variables are set
  const missingRequired = []
  if (!config.whatsapp.phoneNumberId.set) missingRequired.push('WHATSAPP_PHONE_NUMBER_ID')
  if (!config.whatsapp.accessToken.set) missingRequired.push('WHATSAPP_ACCESS_TOKEN')

  const isReady = missingRequired.length === 0

  return NextResponse.json({
    ready: isReady,
    missingRequired,
    config,
    help: {
      message: isReady 
        ? 'WhatsApp is configured and ready to use' 
        : 'WhatsApp is not fully configured. Please set the missing environment variables in Vercel.',
      setupGuide: 'See WHATSAPP_PAYMENT_REMINDERS.md for setup instructions',
      vercelLink: 'https://vercel.com/dashboard → Your Project → Settings → Environment Variables'
    }
  }, {
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

