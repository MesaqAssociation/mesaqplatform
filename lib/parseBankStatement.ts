import pdf from 'pdf-parse'

export type ParsedTransaction = {
  date: string // YYYY-MM-DD format
  name: string // First line - transaction name
  description: string // Subsequent lines - detailed description
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
 * Validate that a date is not more than 30 days in the future
 */
export function isDateTooFarInFuture(dateStr: string): boolean {
  const date = new Date(dateStr)
  const maxFutureDate = new Date()
  maxFutureDate.setDate(maxFutureDate.getDate() + 30)
  return date > maxFutureDate
}

/**
 * Check if statement has transactions too far in the future
 * Returns list of invalid transaction dates if any
 */
export function validateTransactionDates(transactions: ParsedTransaction[]): string[] {
  const invalidDates: string[] = []
  const maxFutureDate = new Date()
  maxFutureDate.setDate(maxFutureDate.getDate() + 30)
  
  for (const txn of transactions) {
    const txnDate = new Date(txn.date)
    if (txnDate > maxFutureDate) {
      invalidDates.push(txn.date)
    }
  }
  
  return [...new Set(invalidDates)] // Return unique dates
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
  // CommBank format: 
  // Line 1: Date TransactionName
  // Line 2+: Description details $amount$balanceCR
  
  const lines = text.split('\n').map(l => l.trim())
  let i = 0
  
  // Skip to transaction section (after "Date" and "TransactionDebitCreditBalance" headers)
  while (i < lines.length) {
    if (lines[i] === 'Date' && i + 1 < lines.length && lines[i + 1].match(/^Transaction.*Debit.*Credit.*Balance/i)) {
      i += 2 // Skip both header lines
      break
    }
    i++
  }
  
  while (i < lines.length) {
    const line = lines[i]
    
    // Skip empty lines, page markers, and closing balance
    // Also skip technical markers like "#* 17181.39879.1.3 ZZ258R3 0303 SL.R3.S951.D308.O V06.00.37"
    // Pattern: starts with digits, has multiple dots, contains uppercase letters and numbers
    if (!line || 
        line.startsWith('Statement ') || 
        line.startsWith('Account Number') ||
        line.startsWith('4326.') ||
        line.startsWith('#*') ||
        line.match(/^Page \d+ of \d+/) ||
        line.match(/CLOSING BALANCE/i) ||
        line.match(/Opening balance.*Total/i) ||
        line.match(/Important Information/i) ||
        line.match(/^\d+\.\d+\.\d+\.\d+/) ||  // Matches "17181.39880.2.3..."
        line.match(/^[A-Z0-9]{2,}\s+\d{4}\s+[A-Z]/)) {  // Matches "ZZ258R3 0303 SL..."
      i++
      continue
    }
    
    // Check if this line starts with a date (DD Mon or DD Mon YYYY)
    // Note: There may be no space between month and transaction name
    // Capture the full date including year if present
    const dateMatch = line.match(/^(\d{1,2}\s+\w{3}(?:\s+\d{2,4})?)\s*(.+)/)
    
    if (dateMatch) {
      const dateStr = dateMatch[1]
      const transactionName = dateMatch[2].trim()
      
      // Look ahead for description lines (until we find amounts or next date)
      let descriptionLines: string[] = []
      let j = i + 1
      let amounts: { value: number; isNegative: boolean }[] = []
      
      while (j < lines.length) {
        const nextLine = lines[j].trim()
        
        // Stop if empty or next transaction
        if (!nextLine || /^\d{1,2}\s+\w{3}/.test(nextLine)) {
          break
        }
        
        // Stop if we hit page markers or technical codes
        if (nextLine.startsWith('Statement ') || 
            nextLine.startsWith('Account Number') ||
            nextLine.startsWith('4326.') ||
            nextLine.startsWith('#*') ||
            nextLine.match(/^Page \d+ of \d+/) ||
            nextLine.match(/^\d+\.\d+\.\d+\.\d+/) ||  // Matches "17181.39880.2.3..."
            nextLine.match(/^[A-Z0-9]{2,}\s+\d{4}\s+[A-Z]/)) {  // Matches "ZZ258R3 0303 SL..."
          break
        }
        
        // Check if this line has amounts (transaction complete)
        const amountPattern = /\$?([\d,]+\.\d{2})/g
        const lineAmounts: { value: number; isNegative: boolean }[] = []
        let match
        
        while ((match = amountPattern.exec(nextLine)) !== null) {
          const value = parseFloat(match[1].replace(/,/g, ''))
          const isNegative = match[0].startsWith('-')
          lineAmounts.push({ value, isNegative })
        }
        
        if (lineAmounts.length > 0) {
          // This line has amounts - it's the last line of this transaction
          amounts = lineAmounts
          
          // Extract description text (remove amounts and CR/DR)
          let descText = nextLine
            .replace(/\$?[\d,]+\.\d{2}/g, '') // Remove amounts
            .replace(/\bCR\b|\bDR\b/gi, '') // Remove CR/DR
            .trim()
          
          if (descText) {
            descriptionLines.push(descText)
          }
          
          j++
          break
        } else {
          // No amounts yet, this is a description line
          descriptionLines.push(nextLine)
          j++
        }
      }
      
      // Skip transactions with no amounts (like headers or opening balance)
      if (amounts.length === 0 || transactionName.match(/OPENING BALANCE/i)) {
        i = j
        continue
      }
      
      // Parse amounts: typically [transaction_amount, balance]
      let debit: number | undefined
      let credit: number | undefined
      let balance: number | undefined
      
      if (amounts.length === 1) {
        // Only balance (unusual, but handle it)
        balance = amounts[0].value
        credit = amounts[0].value // Assume credit if only one amount
      } else if (amounts.length >= 2) {
        // Standard format: transaction amount + balance
        const txnAmount = amounts[0]
        balance = amounts[amounts.length - 1].value
        
        // Determine if debit or credit based on context
        // In CommBank statements, credits are positive, debits would be negative
        if (txnAmount.isNegative) {
          debit = txnAmount.value
        } else {
          credit = txnAmount.value
        }
      }
      
      // Build name and description
      const name = transactionName.substring(0, 200)
      let description = descriptionLines.join(' ')
        .replace(/CR$/g, '') // Remove CR at end
        .replace(/DR$/g, '') // Remove DR at end
        .replace(/\bCR\b/g, '') // Remove CR markers
        .replace(/\bDR\b/g, '') // Remove DR markers
        .trim()
        .substring(0, 500)
      
      const parsedDate = parseAUDate(dateStr, statementPeriod)
      
      const transaction = {
        date: parsedDate,
        name,
        description,
        debit,
        credit,
        balance,
      }
      
      console.log(`\n✅ Parsed transaction:`)
      console.log(`   Date: ${parsedDate}`)
      console.log(`   Name: "${name}"`)
      console.log(`   Description: "${description}"`)
      console.log(`   Credit: ${credit ? `$${credit}` : '-'}`)
      console.log(`   Debit: ${debit ? `$${debit}` : '-'}`)
      console.log(`   Balance: ${balance ? `$${balance}` : '-'}`)
      
      transactions.push(transaction)
      
      // Move to next transaction
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
function parseAUDate(dateStr: string, statementPeriod?: { from: string; to: string }): string {
  // Handle formats: DD/MM/YYYY, DD/MM/YY, DD MMM YYYY, DD-MM-YYYY, etc.
  const cleaned = dateStr.trim().replace(/\s+/g, ' ')
  
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

  // Try DD MMM YYYY (01 Jan 2025, 01 Oct 2025) - with optional year
  const monthMatch = cleaned.match(/(\d{1,2})[\s\/-](\w{3,9})(?:[\s\/-](\d{2,4}))?/i)
  if (monthMatch) {
    const day = monthMatch[1].padStart(2, '0')
    const monthStr = monthMatch[2].toLowerCase()
    let year = monthMatch[3]
    
    const month = monthNames[monthStr]
    if (!month) {
      // Invalid month name
      console.warn(`Invalid month name: "${monthStr}"`)
      return new Date().toISOString().split('T')[0]
    }
    
    // If no year provided, infer intelligently
    if (!year) {
      if (statementPeriod) {
        // Use statement period year, but check if month makes sense
        const periodEndYear = parseInt(statementPeriod.to.split('-')[0])
        const periodEndMonth = parseInt(statementPeriod.to.split('-')[1])
        const periodStartYear = parseInt(statementPeriod.from.split('-')[0])
        const periodStartMonth = parseInt(statementPeriod.from.split('-')[1])
        const txnMonth = parseInt(month)
        
        // If transaction month is within period, use appropriate year
        if (periodStartYear === periodEndYear) {
          year = periodEndYear.toString()
        } else {
          // Statement spans years (e.g., Dec 2024 to Jan 2025)
          // Use end year if month <= end month, else use start year
          if (txnMonth <= periodEndMonth) {
            year = periodEndYear.toString()
          } else {
            year = periodStartYear.toString()
          }
        }
      } else {
        // No statement period - use current year but check if date would be in future
        const currentYear = new Date().getFullYear()
        const currentMonth = new Date().getMonth() + 1
        const txnMonth = parseInt(month)
        
        // If the month is more than 1 month ahead, assume previous year
        if (txnMonth > currentMonth + 1) {
          year = (currentYear - 1).toString()
        } else {
          year = currentYear.toString()
        }
      }
    } else if (year.length === 2) {
      // Convert 2-digit year to 4-digit
      const yearNum = parseInt(year)
      year = yearNum <= 50 ? `20${year}` : `19${year}`
    }
    
    return `${year}-${month}-${day}`
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

