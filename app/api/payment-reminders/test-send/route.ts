import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { 
  sendWhatsAppMessage, 
  formatPhoneNumber,
} from '@/lib/whatsapp'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

/**
 * Test endpoint to send ALL members' balance status
 * Shows + for credit (ahead on payments) and - for debt (behind on payments)
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
    // Check if Wasender API is configured
    if (!process.env.WASENDER_API_KEY) {
      return NextResponse.json({ 
        error: 'Wasender API not configured',
        message: 'WASENDER_API_KEY must be set'
      }, { status: 400 })
    }

    console.log(`🧪 TEST MODE: Fetching all members with balance status...`)

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
        u.created_at
      FROM users u
      ORDER BY u.name
    `)

    console.log(`📊 Found ${members.length} members total`)

    // Calculate balance for each member
    const memberBalances = []
    
    for (const member of members) {
      try {
        // Calculate months since member joined
        const startDate = member.created_at ? new Date(member.created_at) : new Date()
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
        for (const month of months) {
          const payment = paymentMap.get(month) || 0
          runningBalance = runningBalance + payment - monthlyFee
        }

        memberBalances.push({
          memberId: member.member_id,
          name: member.name,
          phone: member.phone,
          balance: runningBalance,
          monthsOwed: months.length,
          totalPaid: payments.reduce((sum, p) => sum + parseFloat(p.total_amount), 0)
        })

      } catch (memberErr: any) {
        console.error(`Error processing member ${member.name}:`, memberErr)
        memberBalances.push({
          memberId: member.member_id,
          name: member.name,
          phone: member.phone,
          balance: 0,
          error: memberErr.message
        })
      }
    }

    // Sort by balance (most negative first, then most positive)
    memberBalances.sort((a, b) => a.balance - b.balance)

    // Format message with all members and their balances
    let message = '📊 MEMBER BALANCE REPORT\n'
    message += `Date: ${new Date().toLocaleDateString('en-AU')}\n`
    message += `Total Members: ${memberBalances.length}\n`
    message += '━━━━━━━━━━━━━━━━━━━━\n\n'

    for (const member of memberBalances) {
      const sign = member.balance >= 0 ? '+' : '-'
      const amount = Math.abs(member.balance).toFixed(2)
      const status = member.balance >= 0 ? '✅' : '❌'
      
      message += `${status} ${member.name}\n`
      message += `   ID: ${member.memberId || 'N/A'} | Balance: ${sign}$${amount}\n`
      if (member.phone) {
        message += `   Phone: ${member.phone}\n`
      }
      message += '\n'
    }

    // Summary statistics
    const behindCount = memberBalances.filter(m => m.balance < 0).length
    const aheadCount = memberBalances.filter(m => m.balance > 0).length
    const evenCount = memberBalances.filter(m => m.balance === 0).length
    const totalDebt = memberBalances
      .filter(m => m.balance < 0)
      .reduce((sum, m) => sum + Math.abs(m.balance), 0)
    const totalCredit = memberBalances
      .filter(m => m.balance > 0)
      .reduce((sum, m) => sum + m.balance, 0)

    message += '━━━━━━━━━━━━━━━━━━━━\n'
    message += '📈 SUMMARY\n'
    message += `Behind: ${behindCount} members (-$${totalDebt.toFixed(2)})\n`
    message += `Ahead: ${aheadCount} members (+$${totalCredit.toFixed(2)})\n`
    message += `Even: ${evenCount} members\n`

    // Send to test number
    const testNumber = process.env.WHATSAPP_TEST_NUMBER
    if (!testNumber) {
      return NextResponse.json({ 
        error: 'Test number not configured',
        message: 'WHATSAPP_TEST_NUMBER must be set',
        data: memberBalances
      }, { status: 400 })
    }

    console.log(`📤 Sending balance report to test number: ${testNumber}`)
    const sent = await sendWhatsAppMessage({ 
      to: formatPhoneNumber(testNumber), 
      body: message 
    })

    if (!sent) {
      return NextResponse.json({ 
        error: 'Failed to send message',
        data: memberBalances
      }, { status: 500 })
    }

    console.log(`✅ TEST COMPLETE: Balance report sent`)

    return NextResponse.json({
      success: true,
      testMode: true,
      totalMembers: memberBalances.length,
      behindCount,
      aheadCount,
      evenCount,
      totalDebt,
      totalCredit,
      messageSent: true,
      sentTo: testNumber,
      data: memberBalances,
      note: 'Balance report sent to test number'
    })
  } catch (err: any) {
    console.error('Test send error:', err)
    console.error('Error stack:', err.stack)
    return NextResponse.json({ 
      error: 'Failed to send test messages',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 })
  }
}

