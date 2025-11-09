import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export async function GET() {
  const token = cookies().get('auth_token')?.value
  
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
    return NextResponse.json({ authenticated: true })
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
}

