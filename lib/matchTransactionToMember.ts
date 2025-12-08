import { Pool } from 'pg'

export type MemberMatch = {
  memberId: string
  memberName: string
  matchType: 'phone' | 'banking_name' | 'member_id' | 'none'
  confidence: 'high' | 'low'
}

/**
 * Match a transaction to a member based on phone number or banking name
 * 
 * IMPORTANT: This should ONLY be called for CREDIT transactions (money coming in)
 * Debit transactions (money going out) should NOT be matched to members
 * 
 * Priority:
 * 1. Phone number in description (10 digits starting with 04)
 * 2. Banking name in transaction name
 * 3. No match -> return null
 */
export async function matchTransactionToMember(
  pool: Pool,
  transactionName: string,
  description: string,
  transactionType?: string // Optional: for validation
): Promise<MemberMatch | null> {
  
  // Safety check: Don't match debit transactions
  if (transactionType === 'debit') {
    return null
  }
  
  // Step 1: Check description for member_id (integer only, not part of phone numbers)
  const { rows: membersWithId } = await pool.query(
    `SELECT id, name, member_id FROM users WHERE member_id IS NOT NULL`
  )
  
  const descriptionLower = description.toLowerCase()
  
  // Check for member_id as a standalone number (not part of longer numbers like phone numbers)
  for (const member of membersWithId) {
    const memberId = String(member.member_id).trim()
    
    // Create all possible variations of the member ID
    const variations = new Set<string>([memberId])
    
    // Handle alphanumeric IDs like A90, A040, etc.
    const alphaMatch = memberId.match(/^([A-Z]+)0*(\d+)$/i)
    if (alphaMatch) {
      const letter = alphaMatch[1].toUpperCase()
      const number = alphaMatch[2]
      
      // Add variations: A40, A040, A0040, etc.
      variations.add(`${letter}${number}`) // e.g., A40
      variations.add(`${letter}0${number}`) // e.g., A040
      variations.add(`${letter}00${number}`) // e.g., A0040
      variations.add(`${letter}${number.padStart(2, '0')}`) // e.g., A40
      variations.add(`${letter}${number.padStart(3, '0')}`) // e.g., A040
      variations.add(`${letter}${number.padStart(4, '0')}`) // e.g., A0040
    }
    
    // Check if any variation exists in the description
    for (const variant of variations) {
      const regex = new RegExp(`\\b${variant}\\b`, 'i')
      if (regex.test(description)) {
        return {
          memberId: member.id,
          memberName: member.name,
          matchType: 'member_id',
          confidence: 'high'
        }
      }
    }
  }
  
  // Step 2: Check description for phone identifier
  const { rows: membersWithPhone } = await pool.query(
    `SELECT id, name, phone FROM users WHERE phone IS NOT NULL AND phone != ''`
  )
  
  // Check if any member's phone identifier appears in the description
  for (const member of membersWithPhone) {
    const phoneIdentifier = member.phone.toLowerCase()
    if (descriptionLower.includes(phoneIdentifier)) {
      return {
        memberId: member.id,
        memberName: member.name,
        matchType: 'phone',
        confidence: 'high'
      }
    }
  }
  
  // Step 2: Check transaction name against banking names (supports multiple names separated by comma)
  // Get all members with banking names
  const { rows: members } = await pool.query(
    `SELECT id, name, banking_name FROM users WHERE banking_name IS NOT NULL AND banking_name != ''`
  )
  
  const transactionNameLower = transactionName.toLowerCase()
  
  // Match full banking names only (separated by comma)
  for (const member of members) {
    // Split by comma to support multiple banking names like "jack adams, mark smith"
    const bankingNames = member.banking_name.split(',').map((n: string) => n.trim().toLowerCase())
    
    for (const bankingName of bankingNames) {
      // Only match the FULL banking name with word boundaries to prevent partial matches
      // e.g., "karim" should NOT match "karimi"
      if (bankingName && bankingName.length >= 3) {
        // Use word boundary regex to match whole words only
        const regex = new RegExp(`\\b${bankingName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
        if (regex.test(transactionName)) {
          return {
            memberId: member.id,
            memberName: member.name,
            matchType: 'banking_name',
            confidence: 'high'
          }
        }
      }
    }
  }
  
  // Step 3: No match found
  return null
}

/**
 * Batch match multiple transactions to members
 * More efficient than calling matchTransactionToMember multiple times
 * 
 * IMPORTANT: Only matches CREDIT transactions. Pass transactionType to filter.
 */
export async function batchMatchTransactions(
  pool: Pool,
  transactions: Array<{ name: string; description: string; type?: string }>
): Promise<Array<MemberMatch | null>> {
  
  // Get all members with member_id, phone numbers and banking names
  const { rows: members } = await pool.query(
    `SELECT id, name, member_id, phone, banking_name FROM users WHERE member_id IS NOT NULL OR phone IS NOT NULL OR banking_name IS NOT NULL`
  )
  
  // Create lookup maps
  const memberIdMap = new Map<number, { id: string; name: string }>()
  const phoneMap = new Map<string, { id: string; name: string }>()
  const bankingNameMap = new Map<string, { id: string; name: string }>()
  
  members.forEach(member => {
    if (member.member_id) {
      memberIdMap.set(member.member_id, { id: member.id, name: member.name })
    }
    if (member.phone) {
      phoneMap.set(member.phone, { id: member.id, name: member.name })
    }
    if (member.banking_name) {
      // Support multiple banking names separated by comma
      const bankingNames = member.banking_name.split(',').map((n: string) => n.trim().toLowerCase())
      bankingNames.forEach(name => {
        if (name) {
          bankingNameMap.set(name, { id: member.id, name: member.name })
        }
      })
    }
  })
  
  // Match each transaction
  return transactions.map(txn => {
    // Safety check: Don't match debit transactions
    if (txn.type === 'debit') {
      return null
    }
    
    // Step 1: Check for member_id in description (with word boundaries)
    for (const [memberId, member] of memberIdMap.entries()) {
      const memberIdStr = String(memberId).trim()
      
      // Create all possible variations of the member ID
      const variations = new Set<string>([memberIdStr])
      
      // Handle alphanumeric IDs like A90, A040, etc.
      const alphaMatch = memberIdStr.match(/^([A-Z]+)0*(\d+)$/i)
      if (alphaMatch) {
        const letter = alphaMatch[1].toUpperCase()
        const number = alphaMatch[2]
        
        // Add variations: A40, A040, A0040, etc.
        variations.add(`${letter}${number}`) // e.g., A40
        variations.add(`${letter}0${number}`) // e.g., A040
        variations.add(`${letter}00${number}`) // e.g., A0040
        variations.add(`${letter}${number.padStart(2, '0')}`) // e.g., A40
        variations.add(`${letter}${number.padStart(3, '0')}`) // e.g., A040
        variations.add(`${letter}${number.padStart(4, '0')}`) // e.g., A0040
      }
      
      // Check if any variation exists in the description
      for (const variant of variations) {
        const regex = new RegExp(`\\b${variant}\\b`, 'i')
        if (regex.test(txn.description)) {
          return {
            memberId: member.id,
            memberName: member.name,
            matchType: 'member_id' as const,
            confidence: 'high' as const
          }
        }
      }
    }
    
    // Step 2: Check for phone identifier in description
    const descriptionLower = txn.description.toLowerCase()
    
    // Check if any member's phone identifier appears in the description
    for (const [phone, member] of phoneMap.entries()) {
      const phoneIdentifier = phone.toLowerCase()
      if (descriptionLower.includes(phoneIdentifier)) {
        return {
          memberId: member.id,
          memberName: member.name,
          matchType: 'phone' as const,
          confidence: 'high' as const
        }
      }
    }
    
    // Step 2: Check banking name (full name match only with word boundaries)
    const txnName = txn.name
    
    // Match full banking names only with word boundaries
    for (const [bankingName, member] of bankingNameMap.entries()) {
      if (bankingName && bankingName.length >= 3) {
        // Use word boundary regex to prevent partial matches like "karim" matching "karimi"
        const regex = new RegExp(`\\b${bankingName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
        if (regex.test(txnName)) {
          return {
            memberId: member.id,
            memberName: member.name,
            matchType: 'banking_name' as const,
            confidence: 'high' as const
          }
        }
      }
    }
    
    // No match
    return null
  })
}

