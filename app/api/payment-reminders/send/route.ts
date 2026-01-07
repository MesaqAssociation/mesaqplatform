import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { sendBulkPaymentReminders, sendPaymentReminder, formatPhoneNumber } from '@/lib/picky-assist'
import { corsHeaders } from '@/lib/cors'
import { storeSentMessagesBatch, storeSentMessage, generateBatchId, SentMessageData } from '@/lib/store-sent-message'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

/**
 * Send payment reminders to members with negative balance
 * 
 * POST /api/payment-reminders/send
 * Body:
 * - testMode: boolean - If true, sends to test number
 * - memberId: string (optional) - Send to specific member only (for testing)
 */
export async function POST(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }
  
  let decoded: any
  try {
    decoded = jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }

  // Check admin/board role
  const userId = decoded.userId || decoded.sub
  const { rows: userRows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId])
  
  if (userRows.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 403, headers: corsHeaders })
  }
  
  const role = (userRows[0].role || '').toLowerCase()
  if (!['admin', 'board', 'manager'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403, headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { testMode = false, memberId } = body
    const testNumber = process.env.WHATSAPP_TEST_NUMBER

    // Get main membership account BSB and account number
    const { rows: accountRows } = await pool.query(`
      SELECT bsb, account_number FROM financial_accounts 
      WHERE is_main_membership_account = true
      LIMIT 1
    `)
    
    // Fallback to first non-donation account if no main account is set
    if (accountRows.length === 0) {
      const { rows: fallbackRows } = await pool.query(`
        SELECT bsb, account_number FROM financial_accounts 
        WHERE is_donation_account = false 
        ORDER BY created_at ASC 
        LIMIT 1
      `)
      if (fallbackRows.length > 0) {
        accountRows.push(fallbackRows[0])
      }
    }

    if (accountRows.length === 0) {
      return NextResponse.json({ 
        error: 'No main account found with BSB/account number' 
      }, { status: 400, headers: corsHeaders })
    }

    const { bsb, account_number } = accountRows[0]

    if (!bsb || !account_number) {
      return NextResponse.json({ 
        error: 'Main account is missing BSB or account number' 
      }, { status: 400, headers: corsHeaders })
    }

    // Get monthly fee
    const { rows: feeRows } = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'monthly_membership_fee' LIMIT 1"
    )
    const monthlyFee = parseFloat(feeRows[0]?.value || '40')

    // If specific member requested (test mode), send to just that member
    if (memberId) {
      // Get member with their balance
      const { rows: memberRows } = await pool.query(`
        SELECT 
          u.id, u.name, u.phone,
          COALESCE(mp.total_paid, 0) - (months.expected_months * $1) AS balance
        FROM users u
        LEFT JOIN (
          SELECT mp.user_id, SUM(mp.amount) as total_paid
          FROM membership_payments mp
          LEFT JOIN transactions t ON t.id = mp.transaction_id
          WHERE mp.transaction_id IS NULL OR t.category = 'Membership Payment'
          GROUP BY mp.user_id
        ) mp ON mp.user_id = u.id
        CROSS JOIN LATERAL (
          SELECT COUNT(*)::int AS expected_months
          FROM generate_series(
            date_trunc('month', COALESCE(u.date_joined, '2025-05-01'::timestamp)),
            date_trunc('month', CURRENT_DATE),
            interval '1 month'
          ) gs
        ) months
        WHERE u.id = $2
      `, [monthlyFee, memberId])

      if (memberRows.length === 0) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404, headers: corsHeaders })
      }

      const member = memberRows[0]
      
      if (!member.phone) {
        return NextResponse.json({ 
          error: 'Member has no phone number' 
        }, { status: 400, headers: corsHeaders })
      }

      // In test mode, send this member's actual message to the test number
      const targetPhone = testMode && testNumber ? testNumber : member.phone

      console.log(`📤 Sending reminder for ${member.name} (balance: $${member.balance})`)
      console.log(`   Target: ${formatPhoneNumber(targetPhone)}${testMode ? ' (TEST MODE)' : ''}`)

      const success = await sendPaymentReminder(
        {
          name: member.name,
          balance: parseFloat(member.balance),
          phone: targetPhone
        },
        bsb,
        account_number
      )

      // Store the sent message with FULL template content matching actual WhatsApp template (English + Persian)
      const balanceOwed = Math.abs(member.balance).toFixed(0)
      await storeSentMessage(pool, {
        messageType: 'payment_reminder',
        templateId: process.env.PICKY_ASSIST_PAYMENT_TEMPLATE_ID,
        messageContent: `Salam ${member.name},\n\nYou are currently $${balanceOwed} behind on your Mesaq Community Membership.\n\nPlease pay ASAP with your phone number in the description to:\nBSB: ${bsb}\nAccount Number: ${account_number}\n\nKind Regards - Mesaq Association\n----------\nسلام ${member.name}،\n\nشما فعلاً $${balanceOwed} بابت حق العضویت انجمن میثاق عقب هستید.\n\nلطفاً هرچه زودتر پرداخت کنید و شماره تلفن خود را در توضیح بنویسید:\n\nBSB: ${bsb}\nAccount Number: ${account_number}\n\nتشکر – انجمن میثاق`,
        recipientPhone: formatPhoneNumber(targetPhone),
        recipientName: member.name,
        recipientMemberId: member.id,
        status: success ? 'sent' : 'failed'
      })

      if (success) {
        return NextResponse.json({ 
          success: true,
          message: testMode 
            ? `Test message sent to ${testNumber} with ${member.name}'s reminder (Balance: $${Math.abs(member.balance).toFixed(0)})`
            : `Payment reminder sent to ${member.name}`,
          member: {
            name: member.name,
            balance: member.balance,
            phone: formatPhoneNumber(member.phone)
          }
        }, { headers: corsHeaders })
      } else {
        return NextResponse.json({ 
          error: 'Failed to send message' 
        }, { status: 500, headers: corsHeaders })
      }
    }

    // Get all members with their balances
    const { rows: members } = await pool.query(`
      SELECT 
        u.id, u.name, u.phone,
        COALESCE(mp.total_paid, 0) - (months.expected_months * $1) AS balance
      FROM users u
      LEFT JOIN (
        SELECT mp.user_id, SUM(mp.amount) as total_paid
        FROM membership_payments mp
        LEFT JOIN transactions t ON t.id = mp.transaction_id
        WHERE mp.transaction_id IS NULL OR t.category = 'Membership Payment'
        GROUP BY mp.user_id
      ) mp ON mp.user_id = u.id
      CROSS JOIN LATERAL (
        SELECT COUNT(*)::int AS expected_months
        FROM generate_series(
          date_trunc('month', COALESCE(u.date_joined, '2025-05-01'::timestamp)),
          date_trunc('month', CURRENT_DATE),
          interval '1 month'
        ) gs
      ) months
      WHERE u.phone IS NOT NULL AND u.phone != ''
    `, [monthlyFee])

    const memberData = members.map(m => ({
      name: m.name,
      balance: parseFloat(m.balance),
      phone: m.phone
    }))

    const result = await sendBulkPaymentReminders(
      memberData,
      bsb,
      account_number,
      testMode,
      testNumber
    )

    // Store sent messages in database
    const batchId = generateBatchId()
    const sentMessageData: SentMessageData[] = members
      .filter((m: any) => parseFloat(m.balance) < 0 && m.phone)
      .map((m: any) => ({
        messageType: 'payment_reminder' as const,
        templateId: process.env.PICKY_ASSIST_PAYMENT_TEMPLATE_ID,
        // Store FULL template message content matching actual WhatsApp template
        messageContent: `Salam ${m.name},\n\nYou are currently $${Math.abs(parseFloat(m.balance)).toFixed(0)} behind on your Mesaq Community Membership.\n\nPlease pay ASAP with your phone number in the description to:\nBSB: ${bsb}\nAccount Number: ${account_number}\n\nKind Regards - Mesaq Association\n----------\nسلام ${m.name}،\n\nشما فعلاً $${Math.abs(parseFloat(m.balance)).toFixed(0)} بابت حق العضویت انجمن میثاق عقب هستید.\n\nلطفاً هرچه زودتر پرداخت کنید و شماره تلفن خود را در توضیح بنویسید:\n\nBSB: ${bsb}\nAccount Number: ${account_number}\n\nتشکر – انجمن میثاق`,
        recipientPhone: formatPhoneNumber(m.phone),
        recipientName: m.name,
        recipientMemberId: m.id,
        status: result.success ? 'sent' : 'failed',
        batchId
      }))

    await storeSentMessagesBatch(pool, sentMessageData, batchId)

    return NextResponse.json({
      success: result.success,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
      totalMembers: members.length,
      testMode,
      bsb,
      accountNumber: account_number
    }, { headers: corsHeaders })
  } catch (err: any) {
    console.error('Payment reminders error:', err)
    return NextResponse.json({ 
      error: 'Failed to send payment reminders',
      details: err.message 
    }, { status: 500, headers: corsHeaders })
  }
}

/**
 * GET: Preview members who would receive reminders
 */
export async function GET(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }
  
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }

  try {
    // Get monthly fee
    const { rows: feeRows } = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'monthly_membership_fee' LIMIT 1"
    )
    const monthlyFee = parseFloat(feeRows[0]?.value || '40')

    // Get members with negative balance
    const { rows: members } = await pool.query(`
      SELECT 
        u.id, u.name, u.phone, u.member_id,
        COALESCE(mp.total_paid, 0) - (months.expected_months * $1) AS balance
      FROM users u
      LEFT JOIN (
        SELECT mp.user_id, SUM(mp.amount) as total_paid
        FROM membership_payments mp
        LEFT JOIN transactions t ON t.id = mp.transaction_id
        WHERE mp.transaction_id IS NULL OR t.category = 'Membership Payment'
        GROUP BY mp.user_id
      ) mp ON mp.user_id = u.id
      CROSS JOIN LATERAL (
        SELECT COUNT(*)::int AS expected_months
        FROM generate_series(
          date_trunc('month', COALESCE(u.date_joined, '2025-05-01'::timestamp)),
          date_trunc('month', CURRENT_DATE),
          interval '1 month'
        ) gs
      ) months
      WHERE u.phone IS NOT NULL AND u.phone != ''
      ORDER BY balance ASC
    `, [monthlyFee])

    const membersWithDebt = members
      .filter((m: any) => parseFloat(m.balance) < 0)
      .map((m: any) => ({
        id: m.id,
        name: m.name,
        memberId: m.member_id,
        phone: m.phone,
        balance: parseFloat(m.balance)
      }))

    // Get account info
    const { rows: accountRows } = await pool.query(`
      SELECT bsb, account_number, account_name FROM financial_accounts 
      WHERE is_donation_account = false 
      ORDER BY created_at ASC 
      LIMIT 1
    `)

    return NextResponse.json({
      members: membersWithDebt,
      totalWithDebt: membersWithDebt.length,
      account: accountRows[0] || null,
      testNumber: process.env.WHATSAPP_TEST_NUMBER || null
    }, { headers: corsHeaders })
  } catch (err: any) {
    console.error('Get reminder preview error:', err)
    return NextResponse.json({ 
      error: 'Failed to get preview',
      details: err.message 
    }, { status: 500, headers: corsHeaders })
  }
}

