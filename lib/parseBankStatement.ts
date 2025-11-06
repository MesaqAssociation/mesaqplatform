import pdf from 'pdf-parse'

export type ParsedTransaction = {
  date: string // YYYY-MM-DD format
  description: string
  debit?: number
  credit?: number
  balance?: number
  reference?: string
}

export type ParsedStatement = {
  transactions: ParsedTransaction[]
  openingBalance?: number
  closingBalance?: number
  accountNumber?: string
  statementPeriod?: { from: string; to: string }
}

/**
 * Parse bank statement PDF
 * Handles common Australian bank formats including:
 * - CommBank, NAB, Westpac, ANZ formats
 * - Transaction tables with Date, Description, Debit, Credit, Balance columns
 */
export async function parseBankStatementPDF(buffer: Buffer): Promise<ParsedStatement> {
  const data = await pdf(buffer)
  const text = data.text

  const transactions: ParsedTransaction[] = []
  let openingBalance: number | undefined
  let closingBalance: number | undefined
  let accountNumber: string | undefined
  let statementPeriod: { from: string; to: string } | undefined

  // Extract account number (common patterns)
  const accountMatch = text.match(/Account\s+(?:Number|No\.?)[\s:]+(\d[\d\s-]+\d)/i)
  if (accountMatch) {
    accountNumber = accountMatch[1].replace(/[\s-]/g, '')
  }

  // Extract statement period
  const periodMatch = text.match(/(\d{1,2}[\s\/-]\w{3}[\s\/-]\d{2,4})\s+to\s+(\d{1,2}[\s\/-]\w{3}[\s\/-]\d{2,4})/i)
  if (periodMatch) {
    statementPeriod = {
      from: parseAUDate(periodMatch[1]),
      to: parseAUDate(periodMatch[2]),
    }
  }

  // Extract opening balance
  const openingMatch = text.match(/Opening\s+Balance[\s:]+\$?\s*([\d,]+\.\d{2})/i)
  if (openingMatch) {
    openingBalance = parseFloat(openingMatch[1].replace(/,/g, ''))
  }

  // Extract closing balance
  const closingMatch = text.match(/Closing\s+Balance[\s:]+\$?\s*([\d,]+\.\d{2})/i)
  if (closingMatch) {
    closingBalance = parseFloat(closingMatch[1].replace(/,/g, ''))
  }

  // Parse transaction lines
  // CommBank format: Date Transaction details (can be multi-line) Amount Balance
  // Multi-line transactions continue until we find amounts
  
  const lines = text.split('\n')
  let i = 0
  
  while (i < lines.length) {
    const line = lines[i].trim()
    
    // Check if this line starts with a date
    const dateMatch = line.match(/^(\d{1,2}\s+\w{3}\s+\d{2,4})\s+(.+)/)
    
    if (dateMatch) {
      const dateStr = dateMatch[1]
      let fullTransaction = dateMatch[2]
      
      // Look ahead to collect multi-line transaction details
      // Continue until we find a line with amounts ($ symbols) or another date
      let j = i + 1
      while (j < lines.length) {
        const nextLine = lines[j].trim()
        
        // Stop if we hit another date line
        if (/^\d{1,2}\s+\w{3}\s+\d{2,4}\s+/.test(nextLine)) {
          break
        }
        
        // Stop if this line has amounts (means current transaction is complete)
        if (/(?:-?\$)[\d,]+\.\d{2}/.test(fullTransaction)) {
          break
        }
        
        // Add this line to the transaction
        if (nextLine && !nextLine.startsWith('Page ') && !nextLine.startsWith('Account ')) {
          fullTransaction += ' ' + nextLine
        }
        
        j++
      }
      
      // Now parse the complete transaction
      const amountPattern = /(?:-?\$)([\d,]+\.\d{2})/g
      const amounts: { value: number; isNegative: boolean }[] = []
      let amountMatch
      
      while ((amountMatch = amountPattern.exec(fullTransaction)) !== null) {
        const fullMatch = amountMatch[0]
        const value = parseFloat(amountMatch[1].replace(/,/g, ''))
        const isNegative = fullMatch.startsWith('-')
        amounts.push({ value, isNegative })
      }
      
      // Log raw transaction for debugging
      console.log(`\n--- Raw Transaction ---`)
      console.log(`Date: ${dateStr}`)
      console.log(`Full text: ${fullTransaction}`)
      console.log(`Amounts found: ${amounts.length}`, amounts)
      
      // Only proceed if we found amounts
      if (amounts.length > 0) {
        // Extract description (remove all amounts and clean up)
        let description = fullTransaction
          .replace(/(?:-?\$)[\d,]+\.\d{2}/g, '') // Remove all amounts with $
          .replace(/\bDR\b|\bCR\b/gi, '') // Remove DR/CR markers
          .replace(/Value Date:[^\n]*/gi, '') // Remove value date
          .replace(/Card xx\d+[^\n]*/gi, '') // Remove card references
          .replace(/USD\s+[\d.]+/gi, '') // Remove USD amounts
          .replace(/EUR\s+[\d.]+/gi, '') // Remove EUR amounts
          .replace(/GBP\s+[\d.]+/gi, '') // Remove GBP amounts
          .replace(/AUD\s+[\d.]+/gi, '') // Remove AUD amounts
          .replace(/PayID Phone from CommBank App/gi, '') // Remove common phrases
          .replace(/CommBank [Aa]pp/gi, '') // Remove app references
          .replace(/to PayID Phone/gi, '')
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim()
        
        // Limit description length
        if (description.length > 200) {
          description = description.substring(0, 200)
        }
        
        let debit: number | undefined
        let credit: number | undefined
        let balance: number | undefined
        
        if (amounts.length === 1) {
          // Only one amount - could be transaction or balance
          // If we only have one amount, assume it's both transaction and balance
          if (amounts[0].isNegative) {
            debit = amounts[0].value
            balance = amounts[0].value // Use the amount as running balance
          } else {
            credit = amounts[0].value
            balance = amounts[0].value
          }
        } else if (amounts.length === 2) {
          // Two amounts - transaction + balance
          const txnAmount = amounts[0]
          balance = amounts[1].value
          
          if (txnAmount.isNegative) {
            debit = txnAmount.value
          } else {
            credit = txnAmount.value
          }
        } else if (amounts.length >= 3) {
          // Multiple amounts - last is balance, second-to-last is transaction
          balance = amounts[amounts.length - 1].value
          const txnAmount = amounts[amounts.length - 2]
          
          if (txnAmount.isNegative) {
            debit = txnAmount.value
          } else {
            credit = txnAmount.value
          }
        }
        
        // Add all transactions (even if debit/credit is undefined, as long as we have amounts)
        const parsedDate = parseAUDate(dateStr)
        const cleanedDesc = cleanDescription(description)
        
        const transaction = {
          date: parsedDate,
          description: cleanedDesc,
          debit,
          credit,
          balance,
        }
        
        console.log(`✅ Parsed transaction:`, transaction)
        
        transactions.push(transaction)
      } else {
        console.log(`⚠️ Skipped - no amounts found`)
      }
      
      // Move to next potential transaction
      i = j
    } else {
      i++
    }
  }

  // Sort by date
  transactions.sort((a, b) => a.date.localeCompare(b.date))

  return {
    transactions,
    openingBalance,
    closingBalance,
    accountNumber,
    statementPeriod,
  }
}

/**
 * Parse Australian date formats to YYYY-MM-DD
 */
function parseAUDate(dateStr: string): string {
  // Handle formats: DD/MM/YYYY, DD/MM/YY, DD MMM YYYY, DD-MM-YYYY, etc.
  const cleaned = dateStr.trim().replace(/\s+/g, ' ')
  
  // Try DD MMM YYYY (01 Jan 2025, 01 Oct 2025)
  const monthNames: { [key: string]: string } = {
    jan: '01', january: '01',
    feb: '02', february: '02',
    mar: '03', march: '03',
    apr: '04', april: '04',
    may: '05',
    jun: '06', june: '06',
    jul: '07', july: '07',
    aug: '08', august: '08',
    sep: '09', september: '09',
    oct: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', december: '12',
  }

  const monthMatch = cleaned.match(/(\d{1,2})[\s\/-](\w{3,9})[\s\/-](\d{2,4})/i)
  if (monthMatch) {
    const day = monthMatch[1].padStart(2, '0')
    const monthStr = monthMatch[2].toLowerCase()
    let year = monthMatch[3]
    // Convert 2-digit year to 4-digit
    if (year.length === 2) {
      const yearNum = parseInt(year)
      // If year is 00-50, assume 2000-2050, if 51-99, assume 1951-1999
      year = yearNum <= 50 ? `20${year}` : `19${year}`
    }
    const month = monthNames[monthStr]
    if (month) {
      return `${year}-${month}-${day}`
    }
  }

  // Try DD/MM/YYYY or DD/MM/YY
  const slashMatch = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0')
    const month = slashMatch[2].padStart(2, '0')
    let year = slashMatch[3]
    // Convert 2-digit year to 4-digit
    if (year.length === 2) {
      const yearNum = parseInt(year)
      // If year is 00-50, assume 2000-2050, if 51-99, assume 1951-1999
      year = yearNum <= 50 ? `20${year}` : `19${year}`
    }
    return `${year}-${month}-${day}`
  }

  // Fallback to current date if parsing fails
  console.warn(`Failed to parse date: "${dateStr}", using current date`)
  return new Date().toISOString().split('T')[0]
}

/**
 * Clean up description text
 */
function cleanDescription(desc: string): string {
  return desc
    .replace(/\s+/g, ' ')
    .replace(/\bDR\b|\bCR\b/gi, '')
    .trim()
    .substring(0, 200)
}

