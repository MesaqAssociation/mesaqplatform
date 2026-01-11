import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { deleteR2Object } from '@/lib/cloudflare-r2'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// DELETE - Delete a document
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
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

  // Only admins/board can delete documents
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
  if (!['admin', 'board', 'manager'].includes(userRole)) {
    return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 })
  }

  try {
    const resolvedParams = params instanceof Promise ? await params : params
    const documentId = resolvedParams.id

    // Get document info before deleting (including file_url for R2 cleanup)
    const { rows: docRows } = await pool.query(
      'SELECT id, file_url FROM community_documents WHERE id = $1',
      [documentId]
    )

    if (docRows.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const document = docRows[0]

    // Delete file from R2 if it exists
    if (document.file_url && document.file_url.includes(process.env.R2_PUBLIC_URL || 'r2.cloudflarestorage.com')) {
      try {
        // Extract the key from the URL (after the bucket URL)
        const url = new URL(document.file_url)
        const key = url.pathname.replace(/^\//, '') // Remove leading slash
        if (key) {
          console.log(`🗑️ Deleting document from R2: ${key}`)
          await deleteR2Object(key)
        }
      } catch (err) {
        console.error('Failed to delete document from R2:', err)
        // Continue with document deletion even if R2 delete fails
      }
    }

    // Delete document from database
    await pool.query(
      'DELETE FROM community_documents WHERE id = $1',
      [documentId]
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Delete document error:', err)
    return NextResponse.json({ 
      error: 'Failed to delete document',
      details: err.message 
    }, { status: 500 })
  }
}

