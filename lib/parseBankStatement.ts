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
  // Pattern: Date Description Amount (Debit/Credit) Balance
  // Common formats:
  // 01 Jan 2025   Payment to WOOLWORTHS     45.50 DR      1,234.56
  // 02/01/2025    SALARY CREDIT                   2,500.00 CR  3,734.56
  
  const lines = text.split('\n')
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Try to match transaction patterns
    // Pattern 1: DD MMM YYYY or DD/MM/YYYY at start
    const datePatterns = [
      /^(\d{1,2}[\s\/]\w{3}[\s\/]\d{2,4}|\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+)/,
    ]

    for (const pattern of datePatterns) {
      const match = line.match(pattern)
      if (!match) continue

      const dateStr = match[1]
      const rest = match[2]

      // Parse the rest of the line for description and amounts
      // Look for amounts: 123.45 or 1,234.56
      const amountPattern = /([\d,]+\.\d{2})/g
      const amounts: number[] = []
      let amountMatch

      while ((amountMatch = amountPattern.exec(rest)) !== null) {
        amounts.push(parseFloat(amountMatch[1].replace(/,/g, '')))
      }

      if (amounts.length === 0) continue

      // Determine transaction type
      const hasDR = /\bDR\b/i.test(rest)
      const hasCR = /\bCR\b/i.test(rest)
      
      // Extract description (everything before first amount, excluding amounts and DR/CR markers)
      let description = rest
        .replace(/[\d,]+\.\d{2}/g, '') // Remove all amounts
        .replace(/\bDR\b|\bCR\b/gi, '') // Remove DR/CR markers
        .replace(/[-$]+/g, '') // Remove dashes and dollar signs
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()
        .substring(0, 200)

      let debit: number | undefined
      let credit: number | undefined
      let balance: number | undefined

      if (amounts.length === 1) {
        // Only one amount - could be debit/credit with no balance
        if (hasDR) {
          debit = amounts[0]
        } else if (hasCR) {
          credit = amounts[0]
        } else {
          // Assume it's a debit if no indicator
          debit = amounts[0]
        }
      } else if (amounts.length === 2) {
        // Two amounts - transaction + balance
        if (hasDR || (!hasCR && !hasDR)) {
          debit = amounts[0]
          balance = amounts[1]
        } else {
          credit = amounts[0]
          balance = amounts[1]
        }
      } else if (amounts.length >= 3) {
        // Three amounts - debit, credit, balance (or similar)
        // Take last as balance, previous as transaction
        balance = amounts[amounts.length - 1]
        if (hasDR) {
          debit = amounts[amounts.length - 2]
        } else {
          credit = amounts[amounts.length - 2]
        }
      }

      transactions.push({
        date: parseAUDate(dateStr),
        description: cleanDescription(description),
        debit,
        credit,
        balance,
      })
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
  // Handle formats: DD/MM/YYYY, DD MMM YYYY, DD-MM-YYYY, etc.
  const cleaned = dateStr.trim().replace(/\s+/g, ' ')
  
  // Try DD MMM YYYY (01 Jan 2025)
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
    const year = monthMatch[3].length === 2 ? `20${monthMatch[3]}` : monthMatch[3]
    const month = monthNames[monthStr]
    if (month) {
      return `${year}-${month}-${day}`
    }
  }

  // Try DD/MM/YYYY
  const slashMatch = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0')
    const month = slashMatch[2].padStart(2, '0')
    const year = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3]
    return `${year}-${month}-${day}`
  }

  // Fallback to current date if parsing fails
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

