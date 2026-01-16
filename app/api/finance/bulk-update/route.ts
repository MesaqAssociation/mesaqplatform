import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Verify admin/board access
async function verifyBoardAuth(): Promise<string | null> {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) return null
  
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as any
    const userId = decoded.userId || decoded.sub
    
    const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId])
    if (rows.length === 0) return null
    
    const role = (rows[0].role || '').toLowerCase()
    const adminRoles = ['admin', 'board', 'manager', 'head', 'finance officer', 'logistics officer', 'public officer']
    if (!adminRoles.includes(role)) return null
    
    return userId
  } catch {
    return null
  }
}

// POST - Bulk update transactions
export async function POST(req: NextRequest) {
  const userId = await verifyBoardAuth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { transactionIds, action, category, matchedMemberId } = body

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ error: 'Transaction IDs required' }, { status: 400 })
    }

    if (!action) {
      return NextResponse.json({ error: 'Action required' }, { status: 400 })
    }

    let updatedCount = 0

    switch (action) {
      case 'mark_as_membership':
        // Update category to Membership Payment and auto-detect membership payments
        const result1 = await pool.query(`
          UPDATE transactions 
          SET category = 'Membership Payment'
          WHERE id = ANY($1)
        `, [transactionIds])
        updatedCount = result1.rowCount || 0
        break

      case 'mark_as_special':
        // Mark as reviewed (keeps as Special Payment but removes from need action)
        const result2 = await pool.query(`
          UPDATE transactions 
          SET reviewed_at = NOW()
          WHERE id = ANY($1)
        `, [transactionIds])
        updatedCount = result2.rowCount || 0
        break

      case 'update_category':
        if (!category) {
          return NextResponse.json({ error: 'Category required for update_category action' }, { status: 400 })
        }
        const result3 = await pool.query(`
          UPDATE transactions 
          SET category = $1
          WHERE id = ANY($2)
        `, [category, transactionIds])
        updatedCount = result3.rowCount || 0
        break

      case 'match_member':
        if (!matchedMemberId) {
          return NextResponse.json({ error: 'Member ID required for match_member action' }, { status: 400 })
        }
        const result4 = await pool.query(`
          UPDATE transactions 
          SET matched_member_id = $1
          WHERE id = ANY($2)
        `, [matchedMemberId, transactionIds])
        updatedCount = result4.rowCount || 0
        break

      case 'mark_as_reviewed':
        // Just mark as reviewed without changing anything else
        const result5 = await pool.query(`
          UPDATE transactions 
          SET reviewed_at = NOW()
          WHERE id = ANY($1)
        `, [transactionIds])
        updatedCount = result5.rowCount || 0
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      updatedCount,
      message: `${updatedCount} transaction${updatedCount !== 1 ? 's' : ''} updated`
    })
  } catch (err: any) {
    console.error('Bulk update error:', err)
    return NextResponse.json({ error: 'Failed to update transactions' }, { status: 500 })
  }
}

