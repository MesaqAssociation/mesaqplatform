import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { matchTransactionsWithAI } from '@/lib/aiPaymentMatcher'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for AI processing

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function POST(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  let userId: string
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as { sub: string }
    userId = decoded.sub
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('🔍 Starting payment detection process...')
    
    // Get monthly fee from system settings
    const { rows: settingsRows } = await pool.query(`
      SELECT value FROM system_settings WHERE key = 'monthly_membership_fee'
    `)
    const monthlyFee = parseFloat(settingsRows[0]?.value || process.env.MONTHLY_FEE || '50.00')
    console.log(`💰 Monthly fee: $${monthlyFee}`)
    
    // Get all members who need to pay (everyone with a join date)
    const { rows: allMembers } = await pool.query(`
      SELECT id, member_id, name, phone, email, banking_name, address, date_joined, role
      FROM users
      WHERE date_joined IS NOT NULL
    `)
    console.log(`👥 Total community members: ${allMembers.length}`)

    // Get current month for payment matching
    const currentMonth = new Date()
    currentMonth.setDate(1)
    const currentMonthStr = currentMonth.toISOString().split('T')[0]

    // Track which members have been matched
    const matchedMemberIds = new Set<string>()
    const matchedTransactionIds = new Set<string>()
    let totalAdded = 0
    const detectionLog: any[] = []

    // ========================================================================
    // STEP 1: Search for member phone numbers
    // ========================================================================
    console.log('\n📱 STEP 1: Searching by phone numbers...')
    let step1Matches = 0
    
    for (const member of allMembers) {
      if (!member.phone || matchedMemberIds.has(member.id)) continue

      const { rows: phoneMatches } = await pool.query(`
        SELECT id, transaction_date, description, amount
        FROM transactions
        WHERE 
          transaction_type = 'credit'
          AND ABS(amount) >= $1 - 0.50 AND ABS(amount) <= $1 + 0.50
          AND description ~ $2
          AND transaction_date >= $3
          AND id NOT IN (SELECT transaction_id FROM membership_payments WHERE transaction_id IS NOT NULL)
        ORDER BY transaction_date DESC
        LIMIT 1
      `, [monthlyFee, member.phone, member.date_joined])

      if (phoneMatches.length > 0) {
        const txn = phoneMatches[0]
        const txnDate = new Date(txn.transaction_date + 'T00:00:00')
        const paymentMonth = new Date(txnDate.getFullYear(), txnDate.getMonth(), 1)
        const paymentMonthStr = paymentMonth.toISOString().split('T')[0]

        try {
          const { rowCount } = await pool.query(`
            INSERT INTO membership_payments (user_id, payment_month, amount, transaction_id, payment_date, status)
            VALUES ($1, $2, $3, $4, $5, 'paid')
            ON CONFLICT (user_id, payment_month) DO NOTHING
          `, [member.id, paymentMonthStr, txn.amount, txn.id, txn.transaction_date])
          
          if (rowCount && rowCount > 0) {
            matchedMemberIds.add(member.id)
            matchedTransactionIds.add(txn.id)
            step1Matches++
            totalAdded++
            detectionLog.push({
              step: 1,
              method: 'phone',
              member: member.name,
              phone: member.phone,
              transaction: txn.description,
              amount: txn.amount,
              month: paymentMonthStr,
              status: 'matched'
            })
          }
        } catch (err) {
          console.error(`Failed to insert payment for ${member.name}:`, err)
        }
      }
    }
    console.log(`✅ Step 1 complete: ${step1Matches} matches by phone`)

    // ========================================================================
    // STEP 2: Search for banking names
    // ========================================================================
    console.log('\n🏦 STEP 2: Searching by banking names...')
    let step2Matches = 0
    let step2Reviews = 0
    
    for (const member of allMembers) {
      if (!member.banking_name || matchedMemberIds.has(member.id)) continue

      // Check if this banking name is shared by multiple members
      const { rows: duplicateCheck } = await pool.query(`
        SELECT COUNT(*) as count
        FROM users
        WHERE LOWER(banking_name) = LOWER($1)
        AND role NOT IN ('Board Member', 'Head Board Member')
        AND date_joined IS NOT NULL
      `, [member.banking_name])
      
      const hasDuplicate = duplicateCheck[0].count > 1

      const { rows: bankingMatches } = await pool.query(`
        SELECT id, transaction_date, description, amount
        FROM transactions
        WHERE 
          transaction_type = 'credit'
          AND ABS(amount) >= $1 - 0.50 AND ABS(amount) <= $1 + 0.50
          AND LOWER(description) LIKE LOWER($2)
          AND transaction_date >= $3
          AND id NOT IN (SELECT transaction_id FROM membership_payments WHERE transaction_id IS NOT NULL)
        ORDER BY transaction_date DESC
        LIMIT 1
      `, [monthlyFee, `%${member.banking_name}%`, member.date_joined])

      if (bankingMatches.length > 0) {
        const txn = bankingMatches[0]
        const txnDate = new Date(txn.transaction_date + 'T00:00:00')
        const paymentMonth = new Date(txnDate.getFullYear(), txnDate.getMonth(), 1)
        const paymentMonthStr = paymentMonth.toISOString().split('T')[0]

        // If banking name is shared, mark as REVIEW instead of PAID
        const paymentStatus = hasDuplicate ? 'review' : 'paid'

        try {
          const { rowCount } = await pool.query(`
            INSERT INTO membership_payments (user_id, payment_month, amount, transaction_id, payment_date, status)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (user_id, payment_month) DO NOTHING
          `, [member.id, paymentMonthStr, txn.amount, txn.id, txn.transaction_date, paymentStatus])
          
          if (rowCount && rowCount > 0) {
            matchedMemberIds.add(member.id)
            matchedTransactionIds.add(txn.id)
            step2Matches++
            if (hasDuplicate) step2Reviews++
            totalAdded++
            detectionLog.push({
              step: 2,
              method: 'banking_name',
              member: member.name,
              banking_name: member.banking_name,
              transaction: txn.description,
              amount: txn.amount,
              month: paymentMonthStr,
              status: hasDuplicate ? 'review' : 'matched',
              note: hasDuplicate ? 'Banking name shared by multiple members - needs manual review' : undefined
            })
          }
        } catch (err) {
          console.error(`Failed to insert payment for ${member.name}:`, err)
        }
      }
    }
    console.log(`✅ Step 2 complete: ${step2Matches} matches by banking name (${step2Reviews} marked for review)`)

    // ========================================================================
    // STEP 3: Get remaining unpaid members
    // ========================================================================
    console.log('\n👤 STEP 3: Identifying unpaid members...')
    const unpaidMembers = allMembers.filter(m => !matchedMemberIds.has(m.id))
    console.log(`📋 Unpaid members remaining: ${unpaidMembers.length}`)

    // ========================================================================
    // STEP 4: Get unmatched transactions
    // ========================================================================
    console.log('\n💳 STEP 4: Identifying unmatched transactions...')
    const { rows: unmatchedTransactions } = await pool.query(`
      SELECT id, transaction_date as date, description, amount
      FROM transactions
      WHERE 
        transaction_type = 'credit'
        AND ABS(amount) >= $1 - 0.50 AND ABS(amount) <= $1 + 0.50
        AND id NOT IN (SELECT transaction_id FROM membership_payments WHERE transaction_id IS NOT NULL)
      ORDER BY transaction_date DESC
    `, [monthlyFee])
    console.log(`💰 Unmatched transactions: ${unmatchedTransactions.length}`)

    // ========================================================================
    // STEP 5: Use AI to match remaining transactions
    // ========================================================================
    console.log('\n🤖 STEP 5: Using AI to match remaining transactions...')
    let step5Matches = 0
    
    if (unpaidMembers.length > 0 && unmatchedTransactions.length > 0) {
      console.log('🧠 Calling OpenAI for intelligent matching...')
      const aiMatches = await matchTransactionsWithAI(
        unmatchedTransactions,
        unpaidMembers,
        monthlyFee
      )
      console.log(`🎯 AI found ${aiMatches.length} potential matches`)

      for (const match of aiMatches) {
        const txn = unmatchedTransactions.find(t => t.id === match.transaction_id)
        const member = unpaidMembers.find(m => m.id === match.user_id)
        
        if (!txn || !member || matchedMemberIds.has(member.id) || matchedTransactionIds.has(txn.id)) {
          continue
        }

        const txnDate = new Date(txn.date + 'T00:00:00')
        const paymentMonth = new Date(txnDate.getFullYear(), txnDate.getMonth(), 1)
        const paymentMonthStr = paymentMonth.toISOString().split('T')[0]

        try {
          const { rowCount } = await pool.query(`
            INSERT INTO membership_payments (user_id, payment_month, amount, transaction_id, payment_date, status)
            VALUES ($1, $2, $3, $4, $5, 'paid')
            ON CONFLICT (user_id, payment_month) DO NOTHING
          `, [member.id, paymentMonthStr, txn.amount, txn.id, txn.date])
          
          if (rowCount && rowCount > 0) {
            matchedMemberIds.add(member.id)
            matchedTransactionIds.add(txn.id)
            step5Matches++
            totalAdded++
            detectionLog.push({
              step: 5,
              method: 'ai',
              member: member.name,
              transaction: txn.description,
              amount: txn.amount,
              month: paymentMonthStr,
              confidence: match.confidence,
              reasoning: match.reasoning,
              status: 'matched'
            })
          }
        } catch (err) {
          console.error(`Failed to insert AI match for ${member.name}:`, err)
        }
      }
    } else {
      console.log('⏭️  Skipping AI matching (no unpaid members or unmatched transactions)')
    }
    console.log(`✅ Step 5 complete: ${step5Matches} matches by AI`)

    // ========================================================================
    // STEP 6: Report remaining unpaid members
    // ========================================================================
    console.log('\n📊 STEP 6: Final status report...')
    const finalUnpaidMembers = allMembers.filter(m => !matchedMemberIds.has(m.id))
    console.log(`⚠️  Members still unpaid: ${finalUnpaidMembers.length}`)
    
    finalUnpaidMembers.forEach(member => {
      detectionLog.push({
        step: 6,
        method: 'unpaid',
        member: member.name,
        phone: member.phone,
        status: 'unpaid'
      })
    })

    // Log the action
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, details) 
       VALUES ($1, 'detect_membership_payments', 'membership_payments', $2)`,
      [userId, JSON.stringify({ 
        totalMembers: allMembers.length,
        totalAdded,
        step1Matches,
        step2Matches,
        step5Matches,
        finalUnpaid: finalUnpaidMembers.length,
        log: detectionLog 
      })]
    )

    console.log('\n✅ Payment detection complete!')
    console.log(`📈 Summary: ${totalAdded} payments matched, ${finalUnpaidMembers.length} members still unpaid`)

    return NextResponse.json({ 
      success: true,
      summary: {
        totalMembers: allMembers.length,
        totalMatched: totalAdded,
        phoneMatches: step1Matches,
        bankingNameMatches: step2Matches,
        aiMatches: step5Matches,
        stillUnpaid: finalUnpaidMembers.length,
      },
      unpaidMembers: finalUnpaidMembers.map(m => ({
        member_id: m.member_id,
        name: m.name,
        phone: m.phone,
      })),
      detectionLog,
      message: `Matched ${totalAdded} payments. ${finalUnpaidMembers.length} members still unpaid.`
    })
  } catch (err: any) {
    console.error('Detect payments error:', err)
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}

