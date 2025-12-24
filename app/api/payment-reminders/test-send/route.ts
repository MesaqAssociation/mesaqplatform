import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { 
  sendWhatsAppMessage, 
  formatPhoneNumber,
} from '@/lib/picky-assist'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

/**
 * Test endpoint to send ONE comprehensive status report with all members
 */
export async function POST(req: NextRequest) {
  // Verify user is authenticated
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
    // Check if Picky Assist API is configured
    if (!process.env.PICKY_ASSIST_API_KEY || !process.env.WHATSAPP_TEST_NUMBER) {
      return NextResponse.json({ 
        error: 'Picky Assist API or test number not configured',
        message: 'PICKY_ASSIST_API_KEY and WHATSAPP_TEST_NUMBER must be set'
      }, { status: 400 })
    }

    console.log(`🧪 TEST MODE: Generating member status report...`)

    // Get monthly fee
    const { rows: feeRows } = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'monthly_membership_fee'"
    )
    const monthlyFee = parseFloat(feeRows[0]?.value || '50.00')

    // Get all members
    const { rows: members } = await pool.query(`
      SELECT 
        u.id,
        u.member_id,
        u.name,
        u.phone,
        u.created_at,
        u.date_joined
      FROM users u
      ORDER BY u.name
    `)

    console.log(`📊 Found ${members.length} members`)

    // Calculate balance for each member
    const allMemberStatuses = []
    
    for (const member of members) {
      try {
        // Calculate months since member joined
        const startDate = member.date_joined ? new Date(member.date_joined) : (member.created_at ? new Date(member.created_at) : new Date())
        const currentDate = new Date()
        const currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
        const now = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        
        const months: string[] = []
        while (currentMonth <= now) {
          months.push(currentMonth.toISOString().split('T')[0])
          currentMonth.setMonth(currentMonth.getMonth() + 1)
        }

        // Get all payments for this member
        const { rows: payments } = await pool.query(`
          SELECT 
            payment_month,
            SUM(amount) as total_amount
          FROM membership_payments
          WHERE user_id = $1
          GROUP BY payment_month
        `, [member.id])

        // Build payment map
        const paymentMap = new Map()
        payments.forEach(p => {
          const monthKey = new Date(p.payment_month).toISOString().split('T')[0]
          paymentMap.set(monthKey, parseFloat(p.total_amount))
        })

        // Calculate running balance
        let runningBalance = 0
        const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0)
        const expectedPayments = months.length
          
        // Running balance = total paid - total expected
        runningBalance = totalPaid - (expectedPayments * monthlyFee)

        allMemberStatuses.push({
          memberId: member.member_id || 'N/A',
          name: member.name,
          phone: member.phone || 'No phone',
          balance: runningBalance
        })

      } catch (memberErr: any) {
        console.error(`Error processing member ${member.name}:`, memberErr)
        allMemberStatuses.push({
          memberId: member.member_id || 'N/A',
          name: member.name,
          phone: member.phone || 'No phone',
          balance: 0
        })
      }
    }

    // Sort by balance (most negative first)
    allMemberStatuses.sort((a, b) => a.balance - b.balance)

    // Build comprehensive status message
    let statusMessage = `📊 MEMBER PAYMENT STATUS REPORT\n`
    statusMessage += `Date: ${new Date().toLocaleDateString()}\n`
    statusMessage += `Total Members: ${members.length}\n\n`
    statusMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`

    // Members behind
    const membersBehind = allMemberStatuses.filter(m => m.balance < 0)
    if (membersBehind.length > 0) {
      statusMessage += `❌ MEMBERS BEHIND (${membersBehind.length}):\n\n`
      for (const member of membersBehind) {
        statusMessage += `${member.name}\n`
        statusMessage += `  ID: ${member.memberId} | Balance: -$${Math.abs(member.balance).toFixed(2)}\n`
        statusMessage += `  Phone: ${member.phone}\n\n`
      }
      statusMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`
    }

    // Members paid up or ahead
    const membersCurrent = allMemberStatuses.filter(m => m.balance >= 0)
    if (membersCurrent.length > 0) {
      statusMessage += `✅ MEMBERS CURRENT/AHEAD (${membersCurrent.length}):\n\n`
      for (const member of membersCurrent) {
        const status = member.balance > 0 ? `+$${member.balance.toFixed(2)}` : '$0.00'
        statusMessage += `${member.name}\n`
        statusMessage += `  ID: ${member.memberId} | Balance: ${status}\n\n`
      }
    }

    statusMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`
    statusMessage += `📈 SUMMARY:\n`
    statusMessage += `Behind: ${membersBehind.length} members\n`
    statusMessage += `Current/Ahead: ${membersCurrent.length} members\n`
    statusMessage += `Total Owed: $${membersBehind.reduce((sum, m) => sum + Math.abs(m.balance), 0).toFixed(2)}`

    // Send the comprehensive message to test number
    const testNumber = process.env.WHATSAPP_TEST_NUMBER
    console.log(`📤 Sending status report to test number: ${testNumber}`)
    
    const success = await sendWhatsAppMessage({
      to: formatPhoneNumber(testNumber),
      body: statusMessage
    })

    if (!success) {
      return NextResponse.json({
        error: 'Failed to send test message',
        testNumber,
        totalMembers: members.length,
        membersBehind: membersBehind.length
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Status report sent successfully to test number',
      testNumber,
      totalMembers: members.length,
      membersBehind: membersBehind.length,
      membersCurrent: membersCurrent.length
    })
  } catch (err: any) {
    console.error('Test send error:', err)
    console.error('Error stack:', err.stack)
    return NextResponse.json({ 
      error: 'Failed to send test message',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 })
  }
}
