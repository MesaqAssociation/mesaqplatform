import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { getBalance } from '@/lib/mobile-message'

export const runtime = 'nodejs'

/**
 * GET /api/messaging/balance
 * Fetch Mobile Message account balance (in credits)
 */
export async function GET(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    if (!process.env.MOBILE_MESSAGE_USERNAME || !process.env.MOBILE_MESSAGE_PASSWORD) {
      return NextResponse.json({ error: 'Mobile Message not configured' }, { status: 400 })
    }

    const { credits, success } = await getBalance()

    if (!success) {
      throw new Error('Failed to fetch balance')
    }
    
    return NextResponse.json({
      credits,
      // Keep balance field for backward compatibility (convert credits to approximate dollar value)
      // 2 credits = 1 message, assuming ~$0.05 per message
      balance: credits * 0.025,
      status: 100,
      message: 'Success'
    })
  } catch (err: any) {
    console.error('Balance check error:', err)
    return NextResponse.json({ 
      error: 'Failed to check balance',
      details: err.message 
    }, { status: 500 })
  }
}
