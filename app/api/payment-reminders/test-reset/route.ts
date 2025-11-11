import { NextRequest, NextResponse } from 'next/server'
import { resetTestAcceleration, getTestInfo } from '@/lib/testTimeAcceleration'

export const runtime = 'nodejs'

/**
 * Reset the test acceleration timer
 * This sets the current time as day 1 for testing
 */
export async function POST(req: NextRequest) {
  // Only allow in test mode
  if (process.env.WHATSAPP_TEST_ACCELERATION !== 'true') {
    return NextResponse.json({ 
      error: 'Test acceleration not enabled' 
    }, { status: 400 })
  }

  resetTestAcceleration()

  return NextResponse.json({
    success: true,
    message: 'Test acceleration reset',
    info: getTestInfo()
  })
}

/**
 * Get current test acceleration info
 */
export async function GET(req: NextRequest) {
  if (process.env.WHATSAPP_TEST_ACCELERATION !== 'true') {
    return NextResponse.json({ 
      testMode: false,
      message: 'Test acceleration not enabled' 
    })
  }

  return NextResponse.json({
    testMode: true,
    info: getTestInfo()
  })
}

