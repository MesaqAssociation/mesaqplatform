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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ member_id: string }> | { member_id: string } }
) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  let userId: string
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as any
    userId = decoded.userId || decoded.sub
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Await params if it's a Promise
    const resolvedParams = params instanceof Promise ? await params : params
    const memberId = resolvedParams.member_id // UUID string

    // Only admins/board/officers can delete
    const { rows: roleRows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId])
    const role = (roleRows[0]?.role || '').toLowerCase()
    const canDelete = ['admin','board','manager','head','finance officer','logistics officer','public officer'].includes(role)
    if (!canDelete) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get member info before deleting (including image for R2 cleanup)
    const { rows: memberRows } = await pool.query(
      'SELECT id, name, email, phone, image FROM users WHERE id = $1',
      [memberId]
    )

    if (memberRows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const member = memberRows[0]

    // Delete profile picture from R2 if it exists
    if (member.image && member.image.includes(process.env.R2_PUBLIC_URL || 'r2.cloudflarestorage.com')) {
      try {
        // Extract the key from the URL (after the bucket URL)
        const url = new URL(member.image)
        const key = url.pathname.replace(/^\//, '') // Remove leading slash
        if (key) {
          console.log(`🗑️ Deleting profile picture from R2: ${key}`)
          await deleteR2Object(key)
        }
      } catch (err) {
        console.error('Failed to delete profile picture from R2:', err)
        // Continue with member deletion even if R2 delete fails
      }
    }

    // Delete member (cascade will handle related records)
    await pool.query('DELETE FROM users WHERE id = $1', [memberId])

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Delete member error:', err)
    return NextResponse.json({ 
      error: 'Failed to delete member' 
    }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ member_id: string }> | { member_id: string } }
) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  let userId: string
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as any
    userId = decoded.userId || decoded.sub
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Await params if it's a Promise
  const resolvedParams = params instanceof Promise ? await params : params
  const memberId = resolvedParams.member_id // UUID string

  try {
    // Only admins/board/officers can update
    const { rows: roleRows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId])
    const role = (roleRows[0]?.role || '').toLowerCase()
    const canEdit = ['admin','board','manager','head','finance officer','logistics officer','public officer'].includes(role)
    if (!canEdit) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await req.json()
    const { name, email, phone, address, group_name, banking_name, household_members, payment_identifiers, custom_data, occupation, payment_plan } = body

    const hh = Number.isFinite(Number(household_members)) ? Number(household_members) : 1
    
    // Validate payment_plan
    const validPlans = ['monthly', 'quarterly', 'semi_annually', 'yearly']
    const memberPaymentPlan = payment_plan && validPlans.includes(payment_plan) ? payment_plan : undefined
    
    // Check if banking_name is unique (if provided)
    if (banking_name && banking_name.trim()) {
      const { rows: existingBanking } = await pool.query(
        'SELECT id, name FROM users WHERE LOWER(banking_name) = LOWER($1) AND id != $2',
        [banking_name.trim(), memberId]
      )
      if (existingBanking.length > 0) {
        return NextResponse.json({ 
          error: `Banking name "${banking_name}" is already used by ${existingBanking[0].name}. Each member must have a unique banking name.` 
        }, { status: 400 })
      }
    }
    
    // Parse payment_identifiers from comma-separated string to array
    let paymentIdsArray: string[] = []
    if (payment_identifiers) {
      if (typeof payment_identifiers === 'string') {
        paymentIdsArray = payment_identifiers.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
      } else if (Array.isArray(payment_identifiers)) {
        paymentIdsArray = payment_identifiers
      }
    }

    // Ensure columns exist
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS occupation TEXT`)
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_plan TEXT DEFAULT 'monthly'`)
    } catch {
      // Columns might already exist
    }

    const { rows } = await pool.query(`
      UPDATE users
      SET 
        name = COALESCE($1, name),
        email = $2,
        phone = $3,
        address = $4,
        group_name = $5,
        banking_name = $6,
        household_members = $7,
        payment_identifiers = $8,
        custom_data = COALESCE($9::jsonb, custom_data, '{}'),
        occupation = $10,
        payment_plan = COALESCE($11, payment_plan, 'monthly')
      WHERE id = $12
      RETURNING id, name, email, phone, address, group_name, banking_name, household_members, payment_identifiers, custom_data, occupation, payment_plan
    `, [
      name?.trim() || null,
      email?.trim() || null,
      phone?.trim() || null,
      address?.trim() || null,
      group_name?.trim() || null,
      banking_name?.trim() || null,
      hh,
      paymentIdsArray.length > 0 ? paymentIdsArray : null,
      custom_data ? JSON.stringify(custom_data) : null,
      occupation?.trim() || null,
      memberPaymentPlan || null,
      memberId
    ])

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, member: rows[0] })
  } catch (err: any) {
    console.error('Update member error:', err)
    return NextResponse.json({ error: 'Failed to update member', details: err.message }, { status: 500 })
  }
}

