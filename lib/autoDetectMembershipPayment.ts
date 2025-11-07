import { Pool } from 'pg'

/**
 * Automatically detect and record membership payment when a transaction is categorized to a member
 * 
 * This function is called after a transaction is inserted with a category (member name).
 * It checks if the transaction should be recorded as a membership payment.
 */
export async function autoDetectMembershipPayment(
  pool: Pool,
  transactionId: string,
  category: string,
  amount: number,
  transactionDate: string
): Promise<boolean> {
  try {
    // Skip if category is "Misc" (not a member payment)
    if (category === 'Misc') {
      return false
    }

    // Find the member by name (category is the member's name)
    const { rows: members } = await pool.query(
      `SELECT id FROM users WHERE name = $1 LIMIT 1`,
      [category]
    )

    if (members.length === 0) {
      console.log(`⚠️ No member found with name: ${category}`)
      return false
    }

    const memberId = members[0].id

    // Determine the payment month from transaction date
    const txnDate = new Date(transactionDate + 'T00:00:00')
    const paymentMonth = new Date(txnDate.getFullYear(), txnDate.getMonth(), 1)
    const paymentMonthStr = paymentMonth.toISOString().split('T')[0]

    // Insert membership payment
    const { rowCount } = await pool.query(
      `INSERT INTO membership_payments (user_id, payment_month, amount, transaction_id, payment_date, status)
       VALUES ($1, $2, $3, $4, $5, 'paid')
       ON CONFLICT (user_id, payment_month) 
       DO UPDATE SET 
         amount = EXCLUDED.amount,
         transaction_id = EXCLUDED.transaction_id,
         payment_date = EXCLUDED.payment_date,
         status = EXCLUDED.status`,
      [memberId, paymentMonthStr, Math.abs(amount), transactionId, transactionDate]
    )

    if (rowCount && rowCount > 0) {
      console.log(`✅ Recorded membership payment: ${category} - $${Math.abs(amount)} for ${paymentMonthStr}`)
      return true
    }

    return false
  } catch (error) {
    console.error('Error auto-detecting membership payment:', error)
    return false
  }
}

