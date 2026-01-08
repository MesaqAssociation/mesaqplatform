import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Helper to check admin role
async function isAdmin(token: string): Promise<boolean> {
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET!) as any
    const userId = decoded.userId || decoded.sub
    
    const { rows } = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    )
    
    if (rows.length === 0) return false
    
    const role = rows[0].role?.toLowerCase()
    return role === 'board' || role === 'admin' || role === 'manager'
  } catch {
    return false
  }
}

// GET - Get all custom fields
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
    // Get custom fields from system_settings
    const { rows } = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'custom_member_fields'"
    )
    
    const fields = rows[0]?.value ? JSON.parse(rows[0].value) : []
    
    return NextResponse.json({ fields })
  } catch (err: any) {
    console.error('Get custom fields error:', err)
    return NextResponse.json({ error: 'Failed to fetch custom fields' }, { status: 500 })
  }
}

// POST - Create a new custom field
export async function POST(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!(await isAdmin(token))) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    const { fieldName } = await req.json()

    if (!fieldName?.trim()) {
      return NextResponse.json({ error: 'Field name is required' }, { status: 400 })
    }

    const cleanName = fieldName.trim()
    
    // Validate field name
    if (!/^[a-zA-Z0-9\s]+$/.test(cleanName)) {
      return NextResponse.json({ error: 'Field name can only contain letters, numbers, and spaces' }, { status: 400 })
    }

    // Create a key-friendly version of the name
    const fieldKey = cleanName.toLowerCase().replace(/\s+/g, '_')

    // Get existing custom fields
    const { rows } = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'custom_member_fields'"
    )
    
    const existingFields = rows[0]?.value ? JSON.parse(rows[0].value) : []
    
    // Check for duplicate
    if (existingFields.some((f: any) => f.key === fieldKey)) {
      return NextResponse.json({ error: 'A field with this name already exists' }, { status: 400 })
    }

    // Add the new field
    const newField = {
      key: fieldKey,
      name: cleanName,
      type: 'text',
      createdAt: new Date().toISOString()
    }
    
    existingFields.push(newField)

    // Save to system_settings
    await pool.query(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('custom_member_fields', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
    `, [JSON.stringify(existingFields)])

    // Ensure users table has custom_data column
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT '{}'
    `)

    return NextResponse.json({ 
      success: true,
      field: newField
    })
  } catch (err: any) {
    console.error('Create custom field error:', err)
    return NextResponse.json({ error: 'Failed to create custom field' }, { status: 500 })
  }
}

// DELETE - Delete a custom field
export async function DELETE(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!(await isAdmin(token))) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    const { fieldKey } = await req.json()

    if (!fieldKey) {
      return NextResponse.json({ error: 'Field key is required' }, { status: 400 })
    }

    // Get existing custom fields
    const { rows } = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'custom_member_fields'"
    )
    
    const existingFields = rows[0]?.value ? JSON.parse(rows[0].value) : []
    
    // Find and remove the field
    const fieldIndex = existingFields.findIndex((f: any) => f.key === fieldKey)
    if (fieldIndex === -1) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 })
    }

    existingFields.splice(fieldIndex, 1)

    // Save to system_settings
    await pool.query(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('custom_member_fields', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
    `, [JSON.stringify(existingFields)])

    // Remove the field data from all users' custom_data
    await pool.query(`
      UPDATE users
      SET custom_data = custom_data - $1
      WHERE custom_data ? $1
    `, [fieldKey])

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Delete custom field error:', err)
    return NextResponse.json({ error: 'Failed to delete custom field' }, { status: 500 })
  }
}

