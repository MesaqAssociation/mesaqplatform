import { Pool } from 'pg'
import { batchMatchTransactions } from '../lib/matchTransactionToMember'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function testCategorization() {
  try {
    console.log('🧪 Testing Transaction Categorization\n')
    console.log('='.repeat(80))
    
    // Test transactions (from the actual PDF)
    const testTransactions = [
      {
        name: 'Transfer from ABDUL MOHAMMADI NetBank',
        description: 'Membership A02'
      },
      {
        name: 'Direct Credit 421520 MOHAMMAD JAFARI',
        description: 'A38'
      },
      {
        name: 'Fast Transfer From NARGIS SUREYA SULTANI',
        description: 'Last pay of joining fee Nargis Sultani'
      },
      {
        name: 'Transfer from GHULAM ABBAS NetBank',
        description: 'Membship A20 Abbas'
      },
      {
        name: 'Fast Transfer From Karim',
        description: 'Membership A03 Karim Khawari'
      },
      {
        name: 'Transfer from Unknown Person',
        description: 'Random payment'
      },
      {
        name: 'Transfer with phone (no spaces)',
        description: 'Payment from 0412345678'
      },
      {
        name: 'Transfer with phone (spaces)',
        description: 'Payment from 04 1234 5678'
      },
      {
        name: 'Transfer with phone (dashes)',
        description: 'Payment from 04-1234-5678'
      },
      {
        name: 'Transfer with non-04 phone',
        description: 'Payment from 1234567890'
      },
    ]
    
    console.log('\n📋 Test Transactions:')
    testTransactions.forEach((txn, i) => {
      console.log(`\n[${i + 1}] Name: "${txn.name}"`)
      console.log(`    Description: "${txn.description}"`)
    })
    
    console.log('\n' + '='.repeat(80))
    console.log('🔍 Running Batch Match...\n')
    
    const matches = await batchMatchTransactions(pool, testTransactions)
    
    console.log('='.repeat(80))
    console.log('📊 RESULTS\n')
    
    let matchedCount = 0
    let miscCount = 0
    
    testTransactions.forEach((txn, i) => {
      const match = matches[i]
      
      console.log(`[${i + 1}] Transaction: "${txn.name}"`)
      
      if (match) {
        matchedCount++
        console.log(`    ✅ MATCHED`)
        console.log(`    👤 Member: ${match.memberName}`)
        console.log(`    🔗 Match Type: ${match.matchType}`)
        console.log(`    📊 Confidence: ${match.confidence}`)
      } else {
        miscCount++
        console.log(`    ⚪ NO MATCH (Category: Misc)`)
      }
      console.log('')
    })
    
    console.log('='.repeat(80))
    console.log('📈 Summary:')
    console.log(`   ✅ Matched: ${matchedCount}`)
    console.log(`   ⚪ Misc: ${miscCount}`)
    console.log(`   📊 Total: ${testTransactions.length}`)
    console.log(`   🎯 Match Rate: ${((matchedCount / testTransactions.length) * 100).toFixed(1)}%`)
    console.log('='.repeat(80))
    
    await pool.end()
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error(error)
    await pool.end()
    process.exit(1)
  }
}

testCategorization()

