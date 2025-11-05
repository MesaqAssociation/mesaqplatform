import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  // Delete the auth cookie
  cookies().delete('auth_token')
  
  return NextResponse.json({ success: true })
}

