import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Proxy download to avoid CORS issues with R2
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const { rows } = await pool.query(
      'SELECT file_name, file_url, file_type FROM community_documents WHERE id = $1',
      [id]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const doc = rows[0]
    
    if (!doc.file_url) {
      return NextResponse.json({ error: 'File URL missing' }, { status: 404 })
    }

    // If it's a data URL, extract and return the binary data
    if (doc.file_url.startsWith('data:')) {
      const matches = doc.file_url.match(/^data:([^;]+);base64,(.+)$/)
      if (!matches) {
        return NextResponse.json({ error: 'Invalid data URL' }, { status: 500 })
      }
      const mimeType = matches[1]
      const base64Data = matches[2]
      const buffer = Buffer.from(base64Data, 'base64')
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${doc.file_name}"`,
        },
      })
    }

    // Fetch from R2 and proxy the response
    const response = await fetch(doc.file_url)
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch file from storage' }, { status: 500 })
    }

    const buffer = await response.arrayBuffer()
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': doc.file_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${doc.file_name}"`,
      },
    })
  } catch (err: any) {
    console.error('Document download error:', err)
    return NextResponse.json({ error: 'Failed to download document' }, { status: 500 })
  }
}

