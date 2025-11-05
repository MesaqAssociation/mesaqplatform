import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function POST(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  let userId: string
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as { sub: string }
    userId = decoded.sub
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const accountId = formData.get('accountId') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // TODO: Implement file upload to R2 and parsing logic
    // For now, just log the action
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, details) 
       VALUES ($1, 'bank_statement_upload', 'bank_statement', $2)`,
      [userId, JSON.stringify({ fileName: file.name, size: file.size })]
    )

    return NextResponse.json({ 
      success: true, 
      message: 'Bank statement upload feature coming soon. For now, please add transactions manually by adjusting the balance.' 
    })
  } catch (err: any) {
    console.error('Upload statement error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

