import pdf from 'pdf-parse'
import fs from 'fs'
import path from 'path'

async function debugParser() {
  try {
    const pdfPath = path.join(process.cwd(), 'public', 'Statement(19) copy.pdf')
    
    console.log('📄 Reading PDF file...')
    const buffer = fs.readFileSync(pdfPath)
    
    console.log('🔍 Extracting text...\n')
    const data = await pdf(buffer)
    const text = data.text
    
    const lines = text.split('\n').map(l => l.trim())
    
    console.log('='.repeat(80))
    console.log('FINDING TRANSACTION SECTION')
    console.log('='.repeat(80))
    
    let i = 0
    
    // Find the "Date" and "TransactionDebitCreditBalance" headers
    while (i < lines.length) {
      const line = lines[i]
      if (line === 'Date' && i + 1 < lines.length && lines[i + 1].match(/^Transaction.*Debit.*Credit.*Balance/i)) {
        console.log(`\n✅ Found transaction headers at lines ${i}-${i+1}:`)
        console.log(`   Line ${i}: "${line}"`)
        console.log(`   Line ${i+1}: "${lines[i+1]}"`)
        i += 2
        break
      }
      i++
    }
    
    if (i >= lines.length) {
      console.log('\n❌ Could not find transaction headers')
      console.log('\nSearching for "Date" lines:')
      for (let j = 0; j < Math.min(lines.length, 100); j++) {
        if (lines[j] === 'Date' || lines[j].includes('Date')) {
          console.log(`  Line ${j}: "${lines[j]}"`)
          if (j + 1 < lines.length) {
            console.log(`  Line ${j+1}: "${lines[j+1]}"`)
          }
        }
      }
      return
    }
    
    i++ // Skip header
    
    console.log('\n' + '='.repeat(80))
    console.log('ANALYZING NEXT 50 LINES')
    console.log('='.repeat(80))
    
    for (let j = 0; j < 50 && (i + j) < lines.length; j++) {
      const line = lines[i + j]
      const dateMatch = line.match(/^(\d{1,2}\s+\w{3})(?:\s+\d{4})?\s+(.+)/)
      
      console.log(`\n[Line ${i + j}]: "${line}"`)
      
      if (dateMatch) {
        console.log(`  ✅ DATE MATCH!`)
        console.log(`     Date: "${dateMatch[1]}"`)
        console.log(`     Transaction: "${dateMatch[2]}"`)
      } else if (line.match(/\$?[\d,]+\.\d{2}/)) {
        console.log(`  💰 Contains amounts`)
      } else if (!line) {
        console.log(`  (empty line)`)
      }
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error(error)
  }
}

debugParser()

