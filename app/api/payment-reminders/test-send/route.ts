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
 * Test endpoint to send personalized payment reminder to members who are behind
 * For now, only sends to 1 member as a test
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

    console.log(`🧪 TEST MODE: Sending personalized payment reminders...`)

    // Get first bank account details
    const { rows: accounts } = await pool.query(`
      SELECT id, account_name, account_number, bsb
      FROM financial_accounts
      WHERE is_donation_account = false OR is_donation_account IS NULL
      ORDER BY created_at ASC
      LIMIT 1
    `)

    if (accounts.length === 0) {
      return NextResponse.json({ 
        error: 'No bank account found',
        message: 'Please add a bank account first'
      }, { status: 400 })
    }

    const bankAccount = accounts[0]
    const accountNumber = bankAccount.account_number || 'Not set'
    const bsb = bankAccount.bsb || 'Not set'

    // Get monthly fee
    const { rows: feeRows } = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'monthly_membership_fee'"
    )
    const monthlyFee = parseFloat(feeRows[0]?.value || '50.00')

    // Get all members with phone numbers
    const { rows: members } = await pool.query(`
      SELECT 
        u.id,
        u.member_id,
        u.name,
        u.phone,
        u.created_at
      FROM users u
      WHERE u.phone IS NOT NULL AND u.phone != ''
      ORDER BY u.name
    `)

    console.log(`📊 Found ${members.length} members with phone numbers`)

    // Calculate balance for each member who is behind
    const membersBehind = []
    
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

        // Only include members who are behind (negative balance)
        if (runningBalance < 0) {
          membersBehind.push({
            memberId: member.member_id,
            name: member.name,
            phone: member.phone,
            balance: runningBalance,
            amountOwed: Math.abs(runningBalance)
          })
        }

      } catch (memberErr: any) {
        console.error(`Error processing member ${member.name}:`, memberErr)
      }
    }

    // Sort by amount owed (most owed first)
    membersBehind.sort((a, b) => a.balance - b.balance)

    if (membersBehind.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No members are behind on payments!',
        totalMembers: members.length,
        membersBehind: 0
      })
    }

    console.log(`💰 Found ${membersBehind.length} members behind on payments`)

    // Send to ALL members who are behind
    let sent = 0
    let failed = 0
    const results = []

    for (const member of membersBehind) {
      try {
        // Skip members without phone numbers
        if (!member.phone) {
          failed++
          results.push({ name: member.name, status: 'failed', reason: 'No phone number' })
          continue
        }

        // Format personalized bilingual message (English + Farsi)
        const message = `Dear ${member.name},

You are behind $${member.amountOwed.toFixed(2)} on your Mesaq membership. Please pay to:

Account Number: ${accountNumber}
BSB: ${bsb}

Make sure to have your phone number in the description or you may not be detected.

Thank you,
Mesaq Association

_____________________________________________________

محترم ${member.name}،

شما در عضویت Mesaq تان از $${member.amountOwed.toFixed(2)} عقب هستید. لطفاً به:

شماره حساب: ${accountNumber}
BSB: ${bsb}

مطمئن شوید که شماره تلیفون تان را در توضیحات دارید در غیر آن ممکن شما تشخیص نشوید.

تشکر،
انجمن مساق`

        console.log(`📤 Sending reminder to ${member.name} at ${member.phone}`)
        const success = await sendWhatsAppMessage({ 
          to: formatPhoneNumber(member.phone), 
          body: message 
        })

        if (success) {
          sent++
          results.push({ name: member.name, phone: member.phone, amountOwed: member.amountOwed, status: 'sent' })
        } else {
          failed++
          results.push({ name: member.name, phone: member.phone, status: 'failed', reason: 'Send failed' })
        }

        // Wait 5 seconds between messages
        await new Promise(resolve => setTimeout(resolve, 5000))

      } catch (err: any) {
        console.error(`Failed to send to ${member.name}:`, err)
        failed++
        results.push({ name: member.name, status: 'failed', reason: err.message })
      }
    }

    console.log(`✅ COMPLETE: Sent ${sent} reminders, ${failed} failed`)

    return NextResponse.json({
      success: true,
      totalMembers: members.length,
      membersBehind: membersBehind.length,
      sent,
      failed,
      results,
      bankAccount: {
        name: bankAccount.account_name,
        accountNumber,
        bsb
      }
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

