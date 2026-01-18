/**
 * Restore transactions from backup JSON
 * Run with: npx tsx scripts/restore-transactions.ts
 */

import { Pool } from 'pg'
import * as fs from 'fs'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const backup = JSON.parse(fs.readFileSync('/Users/elyasalemi/Downloads/mesaq-association_backups_1768174022607-MesaqBackup-January-2026.json', 'utf-8'))

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function restoreTransactions() {
  console.log(`📦 Restoring ${backup.tables.transactions.length} transactions...`)
  
  let inserted = 0
  for (const t of backup.tables.transactions) {
    try {
      await pool.query(`
        INSERT INTO transactions (id, account_id, transaction_date, description, amount, transaction_type, balance_after, source, transaction_name, category, matched_member_id, statement_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO NOTHING
      `, [
        t.id, t.account_id, t.transaction_date, t.description, t.amount, 
        t.transaction_type, t.balance_after, t.source, t.transaction_name, 
        t.category, t.matched_member_id, t.statement_id, t.created_at
      ])
      inserted++
      if (inserted % 50 === 0) console.log(`  Inserted ${inserted}...`)
    } catch (err: any) {
      console.error(`Error inserting transaction ${t.id}:`, err.message)
    }
  }
  
  console.log(`✅ Transactions: ${inserted} inserted`)
  
  console.log(`📦 Restoring ${backup.tables.membership_payments.length} membership payments...`)
  let paymentsInserted = 0
  for (const p of backup.tables.membership_payments) {
    try {
      await pool.query(`
        INSERT INTO membership_payments (id, user_id, payment_month, amount, transaction_id, payment_date, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT DO NOTHING
      `, [
        p.id, p.user_id, p.payment_month, p.amount, 
        p.transaction_id, p.payment_date, p.status, p.created_at
      ])
      paymentsInserted++
    } catch (err: any) {
      console.error(`Error inserting payment ${p.id}:`, err.message)
    }
  }
  
  console.log(`✅ Membership payments: ${paymentsInserted} inserted`)
  
  await pool.end()
}

restoreTransactions()







