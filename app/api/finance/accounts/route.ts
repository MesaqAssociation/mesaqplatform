import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// GET all accounts
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
    const { rows: accounts } = await pool.query(`
      SELECT 
        id,
        account_name,
        account_number,
        current_balance,
        currency,
        created_at
      FROM financial_accounts
      ORDER BY created_at ASC
    `)

    return NextResponse.json({ accounts })
  } catch (err: any) {
    console.error('Get accounts error:', err)
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
  }
}

// POST create new account
export async function POST(req: NextRequest) {
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
    const body = await req.json()
    const { account_name, account_number } = body

    if (!account_name || !account_number) {
      return NextResponse.json({ error: 'Account name and number are required' }, { status: 400 })
    }

    // Validate account number format (14 digits)
    const cleanNumber = account_number.replace(/\s/g, '')
    if (!/^\d{14}$/.test(cleanNumber)) {
      return NextResponse.json({ error: 'Account number must be 14 digits' }, { status: 400 })
    }

    // Check if account number already exists
    const { rows: existing } = await pool.query(
      'SELECT id FROM financial_accounts WHERE account_number = $1',
      [cleanNumber]
    )

    if (existing.length > 0) {
      return NextResponse.json({ error: 'An account with this number already exists' }, { status: 400 })
    }

    // Create new account
    const { rows: newAccount } = await pool.query(
      `INSERT INTO financial_accounts (account_name, account_number, current_balance)
       VALUES ($1, $2, 0.00)
       RETURNING id, account_name, account_number, current_balance, currency, created_at`,
      [account_name, cleanNumber]
    )

    return NextResponse.json({ 
      success: true,
      account: newAccount[0]
    })
  } catch (err: any) {
    console.error('Create account error:', err)
    
    if (err.code === '23505') { // Unique constraint violation
      return NextResponse.json({ error: 'An account with this number already exists' }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}

// DELETE account
export async function DELETE(req: NextRequest) {
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
    const { searchParams } = new URL(req.url)
    const accountId = searchParams.get('id')

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 })
    }

    // Check if there are transactions for this account
    const { rows: txnCheck } = await pool.query(
      'SELECT COUNT(*) as count FROM transactions WHERE account_id = $1',
      [accountId]
    )

    if (parseInt(txnCheck[0].count) > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete account with existing transactions. Delete transactions first.' 
      }, { status: 400 })
    }

    // Delete account
    await pool.query('DELETE FROM financial_accounts WHERE id = $1', [accountId])

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Delete account error:', err)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}

