import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * DISABLED - Automatic payment reminders are turned off
 * 
 * This endpoint does nothing to prevent automatic messages.
 * Payment reminders can only be triggered manually via the test button on the finance page.
 * 
 * Will be enabled when ready for production.
 */
export async function POST(req: NextRequest) {
  return NextResponse.json({ 
    message: 'Automatic reminders are disabled. Use the test button on the finance page.',
    status: 'disabled',
    note: 'This endpoint will be activated when the system is ready for production'
  })
}
