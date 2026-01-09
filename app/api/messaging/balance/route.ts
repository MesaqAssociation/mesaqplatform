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
      return NextResponse.json({ 
        error: 'Mobile Message not configured',
        credits: 0,
        balance: 0
      }, { status: 400 })
    }

    const { credits, success } = await getBalance()

    if (!success) {
      // Return 0 credits but don't fail the request completely
      console.log('Balance check failed, returning 0 credits')
      return NextResponse.json({
        credits: 0,
        balance: 0,
        status: 100,
        message: 'Balance check unavailable - API may be down'
      })
    }
    
    return NextResponse.json({
      credits,
      // Keep balance field for backward compatibility (use credits directly)
      balance: credits,
      status: 100,
      message: 'Success'
    })
  } catch (err: any) {
    console.error('Balance check error:', err)
    // Return a response with 0 balance instead of failing
    return NextResponse.json({ 
      credits: 0,
      balance: 0,
      error: 'Failed to check balance',
      details: err.message 
    })
  }
}
