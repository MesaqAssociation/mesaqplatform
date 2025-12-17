import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
})

// Helper function to verify auth and check if user is board/admin
async function verifyBoardAuth(): Promise<{ userId: string; role: string } | null> {
    const token = cookies().get('auth_token')?.value
    if (!token || !process.env.AUTH_SECRET) {
        return null
    }

    try {
        const decoded = jwt.verify(token, process.env.AUTH_SECRET) as { sub: string }

        // Get user role
        const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [decoded.sub])
        if (rows.length === 0) return null

        const role = rows[0].role

        // Only allow board, admin, and Manager roles
        if (!['board', 'admin', 'Manager'].includes(role)) {
            return null
        }

        return { userId: decoded.sub, role }
    } catch {
        return null
    }
}

// Helper function to get Melbourne date in dd/mm/yyyy format
function getMelbourneDate(): string {
    const now = new Date()
    const melbourneTime = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }))

    const day = String(melbourneTime.getDate()).padStart(2, '0')
    const month = String(melbourneTime.getMonth() + 1).padStart(2, '0')
    const year = melbourneTime.getFullYear()

    return `${day}/${month}/${year}`
}

// Helper function to calculate member balance
async function getMemberBalance(userId: string): Promise<number> {
    try {
        // Get monthly fee
        const { rows: feeRows } = await pool.query(
            "SELECT value FROM system_settings WHERE key = 'monthly_membership_fee'"
        )
        const monthlyFee = parseFloat(feeRows[0]?.value || '40.00')

        // Calculate months owed
        const { rows: balanceRows } = await pool.query(`
      WITH months_owed AS (
        SELECT 
          COUNT(DISTINCT DATE_TRUNC('month', gs::date)) as months
        FROM users u
        CROSS JOIN generate_series(
          GREATEST(u.date_joined::date, '2024-01-01'::date),
          CURRENT_DATE,
          '1 month'::interval
        ) gs
        WHERE u.id = $1
      ),
      months_paid AS (
        SELECT COUNT(*) as months
        FROM membership_payments
        WHERE user_id = $1 AND status = 'paid'
      )
      SELECT 
        (mo.months - COALESCE(mp.months, 0)) as months_behind
      FROM months_owed mo
      LEFT JOIN months_paid mp ON true
    `, [userId])

        const monthsBehind = balanceRows[0]?.months_behind || 0
        return monthsBehind * monthlyFee
    } catch (err) {
        console.error('Error calculating balance for user:', userId, err)
        return 0
    }
}

export async function GET(req: NextRequest) {
    const auth = await verifyBoardAuth()
    if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Get all members with their details
        const { rows: members } = await pool.query(`
      SELECT id, name, email, phone, date_joined
      FROM users
      WHERE date_joined IS NOT NULL
      ORDER BY name ASC
    `)

        console.log(`📊 Found ${members.length} members for report`)

        // Calculate balance for each member
        const memberData = await Promise.all(
            members.map(async (member: any) => {
                const balance = await getMemberBalance(member.id)
                return {
                    id: member.id,
                    name: member.name,
                    email: member.email || '',
                    phone: member.phone || '',
                    dateJoined: member.date_joined ? new Date(member.date_joined).toLocaleDateString('en-AU') : '',
                    balance: balance.toFixed(2)
                }
            })
        )

        console.log(`💰 Calculated balances for ${memberData.length} members`)

        // Generate CSV content
        const csvRows = []
        
        // Header row
        csvRows.push(['Board Member Report'])
        csvRows.push([`Generated: ${getMelbourneDate()}`])
        csvRows.push([]) // Empty row
        
        // Column headers
        csvRows.push(['Member ID', 'Name', 'Email', 'Phone', 'Date Joined', 'Balance'])
        
        // Data rows
        memberData.forEach(member => {
            csvRows.push([
                member.id,
                member.name,
                member.email,
                member.phone,
                member.dateJoined,
                `$${member.balance}`
            ])
        })
        
        // Add summary row
        csvRows.push([]) // Empty row
        const totalBalance = memberData.reduce((sum, m) => sum + parseFloat(m.balance), 0)
        csvRows.push(['', '', '', '', 'Total Balance:', `$${totalBalance.toFixed(2)}`])
        
        // Convert to CSV string
        const csvContent = csvRows.map(row => 
            row.map(cell => {
                // Escape quotes and wrap in quotes if contains comma or quote
                const cellStr = String(cell)
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                    return `"${cellStr.replace(/"/g, '""')}"`
                }
                return cellStr
            }).join(',')
        ).join('\n')
        
        console.log(`✅ Generated CSV with ${memberData.length} members`)

        // Return the CSV file as a download
        return new NextResponse(csvContent, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="Board-Member-Report-${getMelbourneDate().replace(/\//g, '-')}.csv"`,
            },
        })
    } catch (err: any) {
        console.error('❌ Report generation error:', err)
        console.error('Error stack:', err.stack)
        return NextResponse.json({
            error: 'Failed to generate report',
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        }, { status: 500 })
    }
}
