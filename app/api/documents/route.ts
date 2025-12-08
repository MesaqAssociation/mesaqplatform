import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { uploadToR2, isR2Configured } from '@/lib/cloudflare-r2'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// GET - List all documents
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
    const { rows: documents } = await pool.query(`
      SELECT 
        d.id,
        d.title,
        d.description,
        d.file_name,
        d.file_url,
        d.file_size,
        d.file_type,
        d.uploaded_at,
        u.name as uploaded_by_name
      FROM community_documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      ORDER BY d.uploaded_at DESC
    `)

    return NextResponse.json({ documents })
  } catch (err: any) {
    console.error('Get documents error:', err)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}

// POST - Upload new document
export async function POST(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  let decoded: any
  try {
    decoded = jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only admins/board can upload documents
  const userId = decoded.userId || decoded.sub
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token - no user ID' }, { status: 401 })
  }
  
  const { rows: userRows } = await pool.query(
    'SELECT role FROM users WHERE id = $1',
    [userId]
  )
  
  if (userRows.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 403 })
  }
  
  const userRole = (userRows[0].role || '').toLowerCase()
  const allowedRoles = ['admin', 'board', 'manager', 'head', 'finance officer', 'logistics officer', 'public officer']
  if (!allowedRoles.includes(userRole)) {
    return NextResponse.json({ 
      error: 'Unauthorized - Admin/Board only',
      debug: `Your role: ${userRows[0].role}`
    }, { status: 403 })
  }

  try {
    const formData = await req.formData()
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const file = formData.get('file') as File

    if (!title || !file) {
      return NextResponse.json({ error: 'Title and file are required' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let fileUrl: string
    if (isR2Configured()) {
      try {
        fileUrl = await uploadToR2(buffer, file.name, file.type || 'application/octet-stream')
      } catch (r2Error) {
        console.error('R2 upload failed:', r2Error)
        return NextResponse.json({ error: 'Failed to upload file to storage' }, { status: 500 })
      }
    } else {
      // Fallback: store as data URL (same approach used for profile pictures fallback)
      const base64 = buffer.toString('base64')
      fileUrl = `data:${file.type || 'application/octet-stream'};base64,${base64}`
      console.warn('R2 not configured; stored document as data URL in file_url')
    }

    // Save document record
    const { rows: newDoc } = await pool.query(`
      INSERT INTO community_documents 
        (title, description, file_name, file_url, file_size, file_type, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, title, description, file_name, file_url, file_size, uploaded_at
    `, [title, description || null, file.name, fileUrl, file.size, file.type, userId])

    return NextResponse.json({ 
      success: true,
      document: newDoc[0]
    })
  } catch (err: any) {
    console.error('Upload document error:', err)
    return NextResponse.json({ 
      error: 'Failed to upload document',
      details: err.message 
    }, { status: 500 })
  }
}

