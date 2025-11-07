import { Pool } from 'pg'

export type MemberMatch = {
  memberId: string
  memberName: string
  matchType: 'phone' | 'banking_name' | 'none'
  confidence: 'high' | 'low'
}

/**
 * Match a transaction to a member based on phone number or banking name
 * 
 * Priority:
 * 1. Phone number in description (10 digits starting with 04)
 * 2. Banking name in transaction name
 * 3. No match -> return null
 */
export async function matchTransactionToMember(
  pool: Pool,
  transactionName: string,
  description: string
): Promise<MemberMatch | null> {
  
  // Step 1: Check description for phone number (10 digits starting with 04)
  const phonePattern = /\b(04\d{8})\b/g
  const phoneMatches = description.match(phonePattern)
  
  if (phoneMatches && phoneMatches.length > 0) {
    // Try each phone number found
    for (const phone of phoneMatches) {
      const { rows } = await pool.query(
        `SELECT id, name FROM users WHERE phone = $1 LIMIT 1`,
        [phone]
      )
      
      if (rows.length > 0) {
        return {
          memberId: rows[0].id,
          memberName: rows[0].name,
          matchType: 'phone',
          confidence: 'high'
        }
      }
    }
  }
  
  // Step 2: Check transaction name against banking names
  // Get all members with banking names
  const { rows: members } = await pool.query(
    `SELECT id, name, banking_name FROM users WHERE banking_name IS NOT NULL AND banking_name != ''`
  )
  
  const transactionNameLower = transactionName.toLowerCase()
  
  // Try exact match first
  for (const member of members) {
    const bankingNameLower = member.banking_name.toLowerCase()
    if (transactionNameLower.includes(bankingNameLower)) {
      return {
        memberId: member.id,
        memberName: member.name,
        matchType: 'banking_name',
        confidence: 'high'
      }
    }
  }
  
  // Try fuzzy match (split banking name into words)
  for (const member of members) {
    const bankingNameWords = member.banking_name.toLowerCase().split(/\s+/)
    // If all words from banking name appear in transaction name, it's a match
    const allWordsMatch = bankingNameWords.every(word => 
      word.length > 2 && transactionNameLower.includes(word)
    )
    
    if (allWordsMatch && bankingNameWords.length >= 2) {
      return {
        memberId: member.id,
        memberName: member.name,
        matchType: 'banking_name',
        confidence: 'low'
      }
    }
  }
  
  // Step 3: No match found
  return null
}

/**
 * Batch match multiple transactions to members
 * More efficient than calling matchTransactionToMember multiple times
 */
export async function batchMatchTransactions(
  pool: Pool,
  transactions: Array<{ name: string; description: string }>
): Promise<Array<MemberMatch | null>> {
  
  // Get all members with phone numbers and banking names
  const { rows: members } = await pool.query(
    `SELECT id, name, phone, banking_name FROM users WHERE phone IS NOT NULL OR banking_name IS NOT NULL`
  )
  
  // Create lookup maps
  const phoneMap = new Map<string, { id: string; name: string }>()
  const bankingNameMap = new Map<string, { id: string; name: string }>()
  
  members.forEach(member => {
    if (member.phone) {
      phoneMap.set(member.phone, { id: member.id, name: member.name })
    }
    if (member.banking_name) {
      bankingNameMap.set(member.banking_name.toLowerCase(), { id: member.id, name: member.name })
    }
  })
  
  // Match each transaction
  return transactions.map(txn => {
    // Step 1: Check for phone number
    const phonePattern = /\b(04\d{8})\b/g
    const phoneMatches = txn.description.match(phonePattern)
    
    if (phoneMatches) {
      for (const phone of phoneMatches) {
        const member = phoneMap.get(phone)
        if (member) {
          return {
            memberId: member.id,
            memberName: member.name,
            matchType: 'phone' as const,
            confidence: 'high' as const
          }
        }
      }
    }
    
    // Step 2: Check banking name
    const txnNameLower = txn.name.toLowerCase()
    
    // Exact match
    for (const [bankingName, member] of bankingNameMap.entries()) {
      if (txnNameLower.includes(bankingName)) {
        return {
          memberId: member.id,
          memberName: member.name,
          matchType: 'banking_name' as const,
          confidence: 'high' as const
        }
      }
    }
    
    // Fuzzy match
    for (const [bankingName, member] of bankingNameMap.entries()) {
      const words = bankingName.split(/\s+/)
      const allWordsMatch = words.every(word => 
        word.length > 2 && txnNameLower.includes(word)
      )
      
      if (allWordsMatch && words.length >= 2) {
        return {
          memberId: member.id,
          memberName: member.name,
          matchType: 'banking_name' as const,
          confidence: 'low' as const
        }
      }
    }
    
    // No match
    return null
  })
}

