import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

/**
 * GET /api/messaging/balance
 * Fetch Picky Assist account balance
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
    const apiKey = process.env.PICKY_ASSIST_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: 'Picky Assist not configured' }, { status: 400 })
    }

    const response = await fetch('https://app.pickyassist.com/api/v2/check-balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: apiKey })
    })

    if (!response.ok) {
      throw new Error('Failed to fetch balance')
    }

    const data = await response.json()
    
    // Response format: {"balance":59.108,"status":100,"message":"Success"}
    return NextResponse.json({
      balance: data.balance,
      status: data.status,
      message: data.message
    })
  } catch (err: any) {
    console.error('Balance check error:', err)
    return NextResponse.json({ 
      error: 'Failed to check balance',
      details: err.message 
    }, { status: 500 })
  }
}

