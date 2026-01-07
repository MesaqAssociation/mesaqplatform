import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { corsHeaders } from '@/lib/cors'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

// GET all accounts
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const cookieToken = cookies().get('auth_token')?.value
  const token = authHeader?.replace('Bearer ', '') || cookieToken
  
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }
  
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }

  try {
    const { rows: accounts } = await pool.query(`
      SELECT 
        id,
        account_name,
        account_number,
        bsb,
        current_balance,
        currency,
        is_donation_account,
        COALESCE(is_main_membership_account, FALSE) as is_main_membership_account,
        created_at
      FROM financial_accounts
      ORDER BY created_at ASC
    `)

    return NextResponse.json({ accounts }, { headers: corsHeaders })
  } catch (err: any) {
    console.error('Get accounts error:', err)
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500, headers: corsHeaders })
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
    const { account_name, account_number, bsb, is_donation_account } = body

    if (!account_name || !account_number || !bsb) {
      return NextResponse.json({ error: 'Account name, number, and BSB are required' }, { status: 400 })
    }

    // Validate account number format (6 digits)
    const cleanNumber = account_number.replace(/\s/g, '')
    if (!/^\d{6}$/.test(cleanNumber)) {
      return NextResponse.json({ error: 'Account number must be 6 digits' }, { status: 400 })
    }

    // Validate BSB format (6 digits, with or without dash)
    const cleanBSB = bsb.replace(/-/g, '')
    if (!/^\d{6}$/.test(cleanBSB)) {
      return NextResponse.json({ error: 'BSB must be 6 digits (format: XXX-XXX)' }, { status: 400 })
    }
    // Format BSB as XXX-XXX
    const formattedBSB = cleanBSB.slice(0, 3) + '-' + cleanBSB.slice(3)

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
      `INSERT INTO financial_accounts (account_name, account_number, bsb, current_balance, is_donation_account)
       VALUES ($1, $2, $3, 0.00, $4)
       RETURNING id, account_name, account_number, bsb, current_balance, currency, is_donation_account, created_at`,
      [account_name, cleanNumber, formattedBSB, is_donation_account || false]
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

// PATCH - Update account (set as main membership account)
export async function PATCH(req: NextRequest) {
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
    const { accountId, isMainMembershipAccount } = body

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 })
    }

    if (isMainMembershipAccount === true) {
      // First, unset any existing main account
      await pool.query('UPDATE financial_accounts SET is_main_membership_account = FALSE WHERE is_main_membership_account = TRUE')
      
      // Then set this account as main
      await pool.query('UPDATE financial_accounts SET is_main_membership_account = TRUE WHERE id = $1', [accountId])
      
      return NextResponse.json({ 
        success: true,
        message: 'Account set as main membership payment account'
      })
    }

    return NextResponse.json({ error: 'Invalid update' }, { status: 400 })
  } catch (err: any) {
    console.error('Update account error:', err)
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 })
  }
}

// PUT - Update account details (name, bsb, account number)
export async function PUT(req: NextRequest) {
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
    const { accountId, account_name, bsb, account_number } = body

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 })
    }

    if (!account_name?.trim() || !bsb?.trim() || !account_number?.trim()) {
      return NextResponse.json({ error: 'Account name, BSB, and account number are required' }, { status: 400 })
    }

    // Validate BSB format (6 digits)
    const cleanBSB = bsb.replace(/-/g, '')
    if (!/^\d{6}$/.test(cleanBSB)) {
      return NextResponse.json({ error: 'BSB must be 6 digits' }, { status: 400 })
    }
    // Format BSB as XXX-XXX
    const formattedBSB = cleanBSB.slice(0, 3) + '-' + cleanBSB.slice(3)

    // Validate account number (6-10 digits)
    const cleanNumber = account_number.replace(/\s/g, '')
    if (!/^\d{6,10}$/.test(cleanNumber)) {
      return NextResponse.json({ error: 'Account number must be 6-10 digits' }, { status: 400 })
    }

    // Update the account
    await pool.query(`
      UPDATE financial_accounts 
      SET account_name = $1, bsb = $2, account_number = $3, updated_at = NOW()
      WHERE id = $4
    `, [account_name.trim(), formattedBSB, cleanNumber, accountId])

    return NextResponse.json({ 
      success: true,
      message: 'Account details updated successfully'
    })
  } catch (err: any) {
    console.error('Update account details error:', err)
    return NextResponse.json({ error: 'Failed to update account details' }, { status: 500 })
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

    // First delete all related membership_payments that reference transactions from this account
    await pool.query(`
      DELETE FROM membership_payments 
      WHERE transaction_id IN (SELECT id FROM transactions WHERE account_id = $1)
    `, [accountId])

    // Delete all bank statements for this account
    await pool.query('DELETE FROM bank_statements WHERE account_id = $1', [accountId])

    // Delete all transactions for this account
    await pool.query('DELETE FROM transactions WHERE account_id = $1', [accountId])

    // Delete account
    await pool.query('DELETE FROM financial_accounts WHERE id = $1', [accountId])

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Delete account error:', err)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}

