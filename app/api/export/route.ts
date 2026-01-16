import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Helper to convert to CSV
function convertToCSV(data: any[], headers: string[]): string {
  const rows = [headers.join(',')]
  
  data.forEach(item => {
    const row = headers.map(header => {
      const value = item[header]
      if (value === null || value === undefined) return ''
      // Escape quotes and wrap in quotes if contains comma
      const stringValue = String(value).replace(/"/g, '""')
      return stringValue.includes(',') ? `"${stringValue}"` : stringValue
    })
    rows.push(row.join(','))
  })
  
  return rows.join('\n')
}

export async function GET(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  let decoded: any
  try {
    decoded = jwt.verify(token, process.env.AUTH_SECRET)
  } catch (error) {
    console.error('JWT verification failed:', error)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check user role from database
  const userId = decoded.userId || decoded.sub
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const { rows: userRows } = await pool.query(
    'SELECT role FROM users WHERE id = $1',
    [userId]
  )
  
  if (userRows.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 403 })
  }
  
  const userRole = (userRows[0].role || '').toLowerCase()
  const allowedRoles = ['board', 'admin', 'manager']
  
  console.log(`Export request from user with role: ${userRole}`)
  
  if (!allowedRoles.includes(userRole)) {
    console.log(`❌ Role "${userRole}" not in allowed list:`, allowedRoles)
    return NextResponse.json({ 
      error: 'Forbidden - Board/Admin access required',
      yourRole: userRows[0].role,
      allowedRoles 
    }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') // 'members', 'events', 'finance'
    const format = searchParams.get('format') || 'csv' // 'csv' or 'xlsx'

    let data: any[] = []
    let headers: string[] = []
    let filename = 'export'

    switch (type) {
      case 'members':
        // Get monthly fee for balance calculation
        const { rows: feeRows } = await pool.query(
          "SELECT value FROM system_settings WHERE key = 'monthly_membership_fee'"
        )
        const monthlyFee = parseFloat(feeRows[0]?.value || '40.00')

        const { rows: members } = await pool.query(`
          SELECT 
            u.member_id,
            u.name,
            u.email,
            u.phone,
            u.address,
            u.role,
            u.household_members,
            u.banking_name,
            u.group_name,
            u.telegram_id,
            COALESCE(u.payment_plan, 'monthly') as payment_plan,
            COALESCE(u.is_active, true) as is_active,
            to_char(u.date_joined, 'YYYY-MM-DD') as date_joined,
            to_char(u.created_at, 'YYYY-MM-DD') as created_at,
            COALESCE(mp.total_paid, 0) as total_paid,
            (
              SELECT GREATEST(0, COUNT(*)::int)
              FROM generate_series(
                date_trunc('month', COALESCE(u.date_joined, '2025-05-01'::timestamp)),
                date_trunc('month', CURRENT_DATE) - interval '1 month',
                interval '1 month'
              ) gs
            ) as expected_months
          FROM users u
          LEFT JOIN (
            SELECT mp.user_id, SUM(mp.amount) as total_paid
            FROM membership_payments mp
            LEFT JOIN transactions t ON t.id = mp.transaction_id
            WHERE mp.transaction_id IS NULL OR t.category = 'Membership Payment'
            GROUP BY mp.user_id
          ) mp ON mp.user_id = u.id
          ORDER BY u.name ASC
        `)
        
        // Calculate balance for each member
        data = members.map(m => ({
          ...m,
          balance: (m.total_paid || 0) - (m.expected_months * monthlyFee),
          payment_status: (m.total_paid || 0) - (m.expected_months * monthlyFee) >= 0 ? 'PAID' : 'UNPAID'
        }))
        headers = ['member_id', 'name', 'email', 'phone', 'address', 'role', 'group_name', 'household_members', 'banking_name', 'payment_plan', 'is_active', 'date_joined', 'created_at', 'total_paid', 'expected_months', 'balance', 'payment_status']
        filename = `members_export_${new Date().toISOString().split('T')[0]}`
        break

      case 'events':
        const { rows: events } = await pool.query(`
          SELECT 
            id,
            title,
            description,
            to_char(event_date, 'YYYY-MM-DD') as event_date,
            start_time,
            end_time,
            address,
            event_type,
            organizing_group,
            to_char(created_at, 'YYYY-MM-DD') as created_at
          FROM events
          ORDER BY event_date DESC
        `)
        data = events
        headers = ['id', 'title', 'description', 'event_date', 'start_time', 'end_time', 'address', 'event_type', 'organizing_group', 'created_at']
        filename = `events_export_${new Date().toISOString().split('T')[0]}`
        break

      case 'finance':
        const { rows: transactions } = await pool.query(`
          SELECT 
            t.id,
            fa.account_name,
            to_char(t.transaction_date, 'YYYY-MM-DD') as transaction_date,
            t.transaction_name,
            t.description,
            t.category,
            t.amount,
            t.transaction_type,
            t.balance_after,
            t.source,
            m.name as matched_member,
            u.name as created_by,
            bs.file_name as statement_file
          FROM transactions t
          LEFT JOIN financial_accounts fa ON t.account_id = fa.id
          LEFT JOIN users u ON t.created_by = u.id
          LEFT JOIN users m ON t.matched_member_id = m.id
          LEFT JOIN bank_statements bs ON t.statement_id = bs.id
          ORDER BY t.transaction_date DESC
          LIMIT 10000
        `)
        data = transactions
        headers = ['id', 'account_name', 'transaction_date', 'transaction_name', 'description', 'category', 'amount', 'transaction_type', 'balance_after', 'source', 'matched_member', 'created_by', 'statement_file']
        filename = `finance_export_${new Date().toISOString().split('T')[0]}`
        break

      default:
        return NextResponse.json({ error: 'Invalid export type' }, { status: 400 })
    }

    if (data.length === 0) {
      return NextResponse.json({ error: 'No data to export' }, { status: 404 })
    }

    if (format === 'csv') {
      const csv = convertToCSV(data, headers)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      })
    } else if (format === 'xlsx') {
      // For XLSX, we'll return JSON and handle client-side with a library
      // This avoids adding heavy server-side dependencies
      return NextResponse.json({
        data,
        headers,
        filename: `${filename}.xlsx`
      })
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
  } catch (error: any) {
    console.error('Export error:', error)
    
    // Provide more detailed error information
    let errorDetails = error.message
    if (error.code === '42P01') {
      errorDetails = `Table does not exist: ${error.message}`
    }
    
    return NextResponse.json({ 
      error: 'Failed to export data',
      details: errorDetails,
      code: error.code
    }, { status: 500 })
  }
}
