import { Pool } from 'pg'

/**
 * Automatically detect and record membership payment when a transaction is categorized
 * 
 * This function is called after a transaction is inserted.
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
    // Only process Membership Payment category
    if (category !== 'Membership Payment') {
      return false
    }

    // Get the transaction to find the matched member
    const { rows: txns } = await pool.query(
      `SELECT matched_member_id FROM transactions WHERE id = $1`,
      [transactionId]
    )

    if (txns.length === 0 || !txns[0].matched_member_id) {
      console.log(`⚠️ Transaction ${transactionId} has no matched member`)
      return false
    }

    const memberId = txns[0].matched_member_id

    // Determine the payment month from transaction date
    const txnDate = new Date(transactionDate + 'T00:00:00')
    const paymentMonth = new Date(txnDate.getFullYear(), txnDate.getMonth(), 1)
    const paymentMonthStr = paymentMonth.toISOString().split('T')[0]

    // Check if this transaction already has a payment record
    const { rows: existing } = await pool.query(
      `SELECT id FROM membership_payments WHERE transaction_id = $1`,
      [transactionId]
    )
    
    if (existing.length > 0) {
      console.log(`⏭️ Payment already exists for transaction ${transactionId}`)
      return false
    }

    // Insert membership payment
    const { rowCount } = await pool.query(
      `INSERT INTO membership_payments (user_id, payment_month, amount, transaction_id, payment_date, status)
       VALUES ($1, $2, $3, $4, $5, 'paid')`,
      [memberId, paymentMonthStr, Math.abs(amount), transactionId, transactionDate]
    )

    if (rowCount && rowCount > 0) {
      console.log(`✅ Recorded membership payment: member ${memberId} - $${Math.abs(amount)} for ${paymentMonthStr}`)
      return true
    }

    return false
  } catch (error) {
    console.error('Error auto-detecting membership payment:', error)
    return false
  }
}
