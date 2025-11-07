import { parseBankStatementPDF } from '../lib/parseBankStatement'
import fs from 'fs'
import path from 'path'

async function testParser() {
  try {
    const pdfPath = path.join(process.cwd(), 'public', 'Statement(19) copy.pdf')
    
    console.log('📄 Reading PDF file...')
    const buffer = fs.readFileSync(pdfPath)
    
    console.log('🔍 Parsing PDF...\n')
    const result = await parseBankStatementPDF(buffer)
    
    console.log('='.repeat(80))
    console.log('PARSING RESULTS')
    console.log('='.repeat(80))
    
    console.log('\n📊 Summary:')
    console.log(`   Total transactions found: ${result.transactions.length}`)
    console.log(`   Account number: ${result.accountNumber || 'Not found'}`)
    console.log(`   Opening balance: ${result.openingBalance || 'Not found'}`)
    console.log(`   Closing balance: ${result.closingBalance || 'Not found'}`)
    
    if (result.statementPeriod) {
      console.log(`   Statement period: ${result.statementPeriod.from} to ${result.statementPeriod.to}`)
    }
    
    console.log('\n' + '='.repeat(80))
    console.log('TRANSACTIONS DETAIL')
    console.log('='.repeat(80))
    
    result.transactions.forEach((txn, index) => {
      console.log(`\n[${index + 1}] Transaction:`)
      console.log(`   📅 Date: ${txn.date}`)
      console.log(`   📝 Name: "${txn.name}"`)
      console.log(`   📄 Description: "${txn.description}"`)
      console.log(`   💰 Debit: ${txn.debit ? `$${txn.debit.toFixed(2)}` : '-'}`)
      console.log(`   💵 Credit: ${txn.credit ? `$${txn.credit.toFixed(2)}` : '-'}`)
      console.log(`   🏦 Balance: ${txn.balance ? `$${txn.balance.toFixed(2)}` : '-'}`)
      if (txn.reference) {
        console.log(`   🔖 Reference: ${txn.reference}`)
      }
    })
    
    console.log('\n' + '='.repeat(80))
    console.log('✅ Parsing complete!')
    console.log('='.repeat(80))
    
  } catch (error: any) {
    console.error('❌ Error parsing PDF:', error.message)
    console.error(error)
  }
}

testParser()

