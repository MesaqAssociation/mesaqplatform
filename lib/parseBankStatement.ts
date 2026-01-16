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

  // Extract statement period - look for "Statement Period X - Y" or "X to Y" format
  // Handle variations: "Statement\nPeriod", "Statement Period:", spaces, dashes
  const periodMatch = text.match(/Statement[\s\n]*Period[\s:\n]*(\d{1,2}\s*\w{3}\s*\d{2,4})\s*(?:to|-)\s*(\d{1,2}\s*\w{3}\s*\d{2,4})/i)
  if (periodMatch) {
    statementPeriod = {
      from: parseAUDate(periodMatch[1].replace(/\s+/g, ' ').trim()),
      to: parseAUDate(periodMatch[2].replace(/\s+/g, ' ').trim()),
    }
    console.log(`📅 Extracted statement period from header: ${statementPeriod.from} to ${statementPeriod.to}`)
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
    // IMPORTANT: Only match valid month abbreviations to avoid false positives like "07 membership"
    const dateMatch = line.match(/^(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s+\d{2,4})?)\s*(.+)/i)
    
    if (dateMatch) {
      const dateStr = dateMatch[1]
      let transactionName = dateMatch[2].trim()
      
      // Look ahead for description lines (until we find amounts or next date)
      let descriptionLines: string[] = []
      let j = i + 1
      let amounts: { value: number; isNegative: boolean; isDebitFormat: boolean }[] = []
      
      // Helper function to extract amounts from text
      const extractAmounts = (text: string): { value: number; isNegative: boolean; isDebitFormat: boolean }[] => {
        const found: { value: number; isNegative: boolean; isDebitFormat: boolean }[] = []
        
        // Pattern 1: Amounts starting with $ (e.g., "$40.00", "$42,823.83")
        // Use proper currency format: 1-3 leading digits, then optional ,XXX groups
        const dollarStartPattern = /\$(\d{1,3}(?:,\d{3})*\.\d{2})/g
        let match
        while ((match = dollarStartPattern.exec(text)) !== null) {
          const value = parseFloat(match[1].replace(/,/g, ''))
          found.push({ value, isNegative: false, isDebitFormat: false })
        }
        
        // Pattern 2: Debit format - amounts before $$ (debit column marker + balance column marker)
        // In CommBank PDFs, debits show as [amount]$$[balance] due to concatenation
        const doubleDollarIdx = text.indexOf('$$')
        if (doubleDollarIdx > 0) {
          const beforeDoubleDollar = text.substring(0, doubleDollarIdx)
          
          // Find any digits/commas ending with .XX at the end of the string
          const amountMatch = beforeDoubleDollar.match(/(\d[\d,]*\.\d{2})$/)
          if (amountMatch) {
            const amountStr = amountMatch[1]
            
            // Find ALL valid currency formats by trimming from left
            // Valid format: 1-3 leading digits, then ,XXX groups, then .XX
            interface ValidAmount {
              amount: string
              value: number
              combinedLeading: string
              isCleanBoundary: boolean
            }
            const validAmounts: ValidAmount[] = []
            let checkStr = amountStr
            
            while (checkStr.length > 0) {
              // Valid currency format: 1-3 leading digits (no leading zeros except for < $1), 
              // then optional ,XXX groups, then .XX
              // Skip amounts with leading zeros (like 00.00, 07.50) as they're not valid currency
              if (/^\d{1,3}(?:,\d{3})*\.\d{2}$/.test(checkStr) && !/^0\d/.test(checkStr)) {
                const value = parseFloat(checkStr.replace(/,/g, ''))
                
                // Skip zero amounts (not meaningful transactions)
                if (value > 0) {
                  const offset = amountStr.length - checkStr.length
                  const checkStartInBefore = amountMatch.index! + offset
                  const charBefore = checkStartInBefore > 0 ? beforeDoubleDollar[checkStartInBefore - 1] : ''
                  
                  // Count consecutive digits immediately before this amount
                  let digitsBefore = ''
                  for (let i = checkStartInBefore - 1; i >= 0 && beforeDoubleDollar[i] >= '0' && beforeDoubleDollar[i] <= '9'; i--) {
                    digitsBefore = beforeDoubleDollar[i] + digitsBefore
                  }
                  
                  const leadingDigits = (checkStr.match(/^(\d+)/) || ['', ''])[1]
                  const combinedLeading = digitsBefore + leadingDigits
                  
                  validAmounts.push({
                    amount: checkStr,
                    value: value,
                    combinedLeading: combinedLeading,
                    isCleanBoundary: charBefore === '' || (!(charBefore >= '0' && charBefore <= '9') && charBefore !== ',')
                  })
                }
              }
              checkStr = checkStr.substring(1)
              if (checkStr.startsWith(',')) checkStr = checkStr.substring(1)
            }
            
            // Prefer clean boundary (no digit/comma before)
            const cleanBoundary = validAmounts.find(v => v.isCleanBoundary)
            if (cleanBoundary) {
              found.push({ value: cleanBoundary.value, isNegative: false, isDebitFormat: true })
            } else {
              // Check if original amount string has commas (proper currency formatting)
              const hasCommas = amountStr.includes(',')
              
              if (hasCommas) {
                // With commas, the comma placement indicates structure
                // Pick the amount that respects comma grouping (smallest valid)
                const brokenBoundaryAmounts = validAmounts
                  .filter(v => v.combinedLeading.length > 3)
                  .sort((a, b) => a.value - b.value)
                
                if (brokenBoundaryAmounts.length > 0) {
                  found.push({ value: brokenBoundaryAmounts[0].value, isNegative: false, isDebitFormat: true })
                } else if (validAmounts.length > 0) {
                  const smallest = validAmounts.reduce((a, b) => a.value < b.value ? a : b)
                  found.push({ value: smallest.value, isNegative: false, isDebitFormat: true })
                }
              } else {
                // No commas - garbage reference numbers are prepended (e.g., "2067375.00")
                // Pick the LARGEST valid amount (more likely to be the actual transaction)
                const brokenBoundaryAmounts = validAmounts
                  .filter(v => v.combinedLeading.length > 3)
                  .sort((a, b) => b.value - a.value) // Sort DESCENDING - pick largest
                
                if (brokenBoundaryAmounts.length > 0) {
                  found.push({ value: brokenBoundaryAmounts[0].value, isNegative: false, isDebitFormat: true })
                } else if (validAmounts.length > 0) {
                  // Fallback: largest valid amount
                  const largest = validAmounts.reduce((a, b) => a.value > b.value ? a : b)
                  found.push({ value: largest.value, isNegative: false, isDebitFormat: true })
                }
              }
            }
          }
        }
        
        return found
      }
      
      // FIRST: Check if the transaction name line itself contains amounts
      // This happens for some transactions like cheques where everything is on one line
      // e.g., "Chq 000078 presented DANDENONG PLAZA2,500.00$$51,062.83CR"
      const txnNameAmounts = extractAmounts(transactionName)
      if (txnNameAmounts.length >= 2) {
        // Amounts found in transaction name - single line transaction
        amounts = txnNameAmounts
        
        // Check for DR marker
        const hasDRMarker = /\bDR\b/i.test(transactionName)
        const hasCRMarker = /\bCR\b/i.test(transactionName)
        if (hasDRMarker && !hasCRMarker) {
          amounts.forEach(amt => { amt.isNegative = true })
        }
        
        // Clean the transaction name by removing amounts and CR/DR
        transactionName = transactionName
          .replace(/\$?[\d,]+\.\d{2}\s*\$?/g, '') // Remove amounts
          .replace(/\s*(?:CR|DR)\s*$/gi, '') // Remove CR/DR at end
          .replace(/\bCR\b|\bDR\b/gi, '') // Remove standalone CR/DR
          .trim()
        
        console.log(`   Single-line transaction detected: ${transactionName}`)
      } else {
        // Look for amounts in following lines
        while (j < lines.length) {
          const nextLine = lines[j].trim()
          
          // Stop if empty or next transaction
          if (!nextLine || /^\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(nextLine)) {
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
          const lineAmounts = extractAmounts(nextLine)
          
          if (lineAmounts.length > 0) {
            // This line has amounts - it's the last line of this transaction
            // Check for DR marker to identify debits (before we remove it)
            const hasDRMarker = /\bDR\b/i.test(nextLine)
            const hasCRMarker = /\bCR\b/i.test(nextLine)
            
            // Mark amounts as debit if DR marker present
            if (hasDRMarker && !hasCRMarker) {
              lineAmounts.forEach(amt => { amt.isNegative = true })
            }
            
            amounts = lineAmounts
            
            // Extract description text (remove amounts and CR/DR)
            let descText = nextLine
              .replace(/\$?[\d,]+\.\d{2}\s*\$?/g, '') // Remove amounts
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
      }
      
      // Skip transactions with no amounts (like headers or opening balance)
      if (amounts.length === 0 || transactionName.match(/OPENING BALANCE/i)) {
        i = j
        continue
      }
      
      // Parse amounts: typically [transaction_amount, balance] or [debit, credit, balance]
      let debit: number | undefined
      let credit: number | undefined
      let balance: number | undefined
      
      if (amounts.length === 1) {
        // Only one amount - likely just the balance
        balance = amounts[0].value
        // Don't assume credit, let balance-based detection handle it
      } else if (amounts.length >= 2) {
        // Check if any amount has isDebitFormat flag (CommBank debit: "2,500.00 $$")
        // If so, that's the transaction amount and the other is the balance
        const debitFormatAmount = amounts.find(a => a.isDebitFormat === true)
        const nonDebitFormatAmounts = amounts.filter(a => a.isDebitFormat !== true)
        
        let txnAmount: { value: number; isNegative: boolean; isDebitFormat?: boolean }
        
        if (debitFormatAmount && nonDebitFormatAmounts.length > 0) {
          // CommBank debit format detected - use the debit format amount as transaction
          // and the other amount(s) as balance
          txnAmount = debitFormatAmount
          balance = nonDebitFormatAmounts[nonDebitFormatAmounts.length - 1].value
          console.log(`   Found debit format amount: $${debitFormatAmount.value}, balance: $${balance}`)
        } else {
          // Standard format: transaction amount + balance OR debit + credit + balance
          txnAmount = amounts[0]
          balance = amounts[amounts.length - 1].value
        }
        
        // Determine if debit or credit:
        // 1. Check if CommBank debit format (amount followed by $, e.g., "2,500.00 $")
        // 2. Check if marked as negative (has - sign or DR marker)
        // 3. Check for common debit transaction name patterns (Chq, cheque, etc.)
        const nameLower = transactionName.toLowerCase()
        const isDebitName = nameLower.includes('chq') || 
                           nameLower.includes('cheque') ||
                           nameLower.includes('payment') || 
                           nameLower.includes('transfer out') ||
                           nameLower.includes('withdrawal') ||
                           nameLower.includes('eftpos') ||
                           nameLower.includes('direct debit') ||
                           nameLower.includes('bpay') ||
                           nameLower.includes('fee') ||
                           nameLower.includes('atm') ||
                           nameLower.includes('osko') ||
                           nameLower.includes('pay anyone')
        
        // CommBank shows debits as "2,500.00 $" ($ after amount)
        const isDebitFormat = txnAmount.isDebitFormat === true
        
        if (txnAmount.isNegative || isDebitFormat || isDebitName) {
          debit = txnAmount.value
          const reason = isDebitFormat ? 'CommBank debit format ($ after amount)' : 
                        isDebitName ? 'by name pattern' : 'by marker'
          console.log(`   Detected as DEBIT: ${reason} - ${transactionName}`)
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

