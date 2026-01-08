import { Pool } from 'pg'

export type MemberMatch = {
  memberId: string
  memberName: string
  matchType: 'phone' | 'banking_name' | 'member_id' | 'payment_identifier' | 'none'
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
  
  // Get all members with member_id
  const { rows: membersWithId } = await pool.query(
    `SELECT id, name, member_id FROM users WHERE member_id IS NOT NULL`
  )
  
  // Get all members (for phone and banking name matching)
  const { rows: allMembers } = await pool.query(
    `SELECT id, name, phone, banking_name FROM users WHERE phone IS NOT NULL OR banking_name IS NOT NULL`
  )
  
  // Get all members with payment identifiers
  const { rows: membersWithPaymentIds } = await pool.query(
    `SELECT id, name, payment_identifiers FROM users WHERE payment_identifiers IS NOT NULL AND array_length(payment_identifiers, 1) > 0`
  )
  
  const descriptionLower = description.toLowerCase()
  const transactionNameLower = transactionName.toLowerCase()
  
  // STEP 0: Check for payment identifiers (HIGHEST PRIORITY - case-insensitive)
  for (const member of membersWithPaymentIds) {
    if (member.payment_identifiers && Array.isArray(member.payment_identifiers)) {
      for (const identifier of member.payment_identifiers) {
        const idLower = identifier.toLowerCase()
        // Check in both description and transaction name (case-insensitive)
        if (descriptionLower.includes(idLower) || transactionNameLower.includes(idLower)) {
          return {
            memberId: member.id,
            memberName: member.name,
            matchType: 'payment_identifier',
            confidence: 'high'
          }
        }
      }
    }
  }
  
  // STEP 1: Check for member_id in description (with zero-padding variations)
  for (const member of membersWithId) {
    const memberId = String(member.member_id).trim()
    
    // Handle alphanumeric IDs like A05, A5, A005
    const alphaMatch = memberId.match(/^([A-Z]+)(\d+)$/i)
    if (alphaMatch) {
      const letter = alphaMatch[1].toUpperCase()
      const number = alphaMatch[2]
      
      // Generate variations with different zero-padding
      // A5 → [A5, A05, A005]
      // A50 → [A50, A050, A0050]
      const variations = new Set<string>()
      variations.add(`${letter}${number}`) // Original
      variations.add(`${letter}${number.padStart(2, '0')}`) // 2 digits
      variations.add(`${letter}${number.padStart(3, '0')}`) // 3 digits
      variations.add(`${letter}${number.padStart(4, '0')}`) // 4 digits
      
      for (const variant of variations) {
        // Match anywhere in description (case-insensitive)
        const regex = new RegExp(variant, 'i')
        if (regex.test(description)) {
          return {
            memberId: member.id,
            memberName: member.name,
            matchType: 'member_id',
            confidence: 'high'
          }
        }
      }
    } else {
      // For non-alphanumeric member IDs, exact match with word boundary
      const regex = new RegExp(`\\b${memberId}\\b`, 'i')
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
  
  // STEP 2: Check for phone number in description
  for (const member of allMembers) {
    if (member.phone) {
      // Remove all non-digits from phone
      const cleanPhone = member.phone.replace(/\D/g, '')
      // Try matching last 9 digits (Australian mobile without 0)
      if (cleanPhone.length >= 9) {
        const last9 = cleanPhone.slice(-9)
        if (description.includes(last9)) {
          return {
            memberId: member.id,
            memberName: member.name,
            matchType: 'phone',
            confidence: 'high'
          }
        }
      }
      // Try matching full number
      if (description.includes(cleanPhone)) {
        return {
          memberId: member.id,
          memberName: member.name,
          matchType: 'phone',
          confidence: 'medium'
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
  
  // Get all members with member_id, phone numbers, banking names, and payment identifiers
  const { rows: members } = await pool.query(
    `SELECT id, name, member_id, phone, banking_name, payment_identifiers FROM users WHERE member_id IS NOT NULL OR phone IS NOT NULL OR banking_name IS NOT NULL OR (payment_identifiers IS NOT NULL AND array_length(payment_identifiers, 1) > 0)`
  )
  const allMembers = members
  
  // Create lookup maps
  const memberIdMap = new Map<number, { id: string; name: string }>()
  const phoneMap = new Map<string, { id: string; name: string }>()
  const bankingNameMap = new Map<string, { id: string; name: string }>()
  const paymentIdMap = new Map<string, { id: string; name: string }>()
  
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
    if (member.payment_identifiers && Array.isArray(member.payment_identifiers)) {
      member.payment_identifiers.forEach((identifier: string) => {
        if (identifier) {
          paymentIdMap.set(identifier.toLowerCase(), { id: member.id, name: member.name })
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
    
    const descriptionLower = txn.description.toLowerCase()
    const txnNameLower = txn.name.toLowerCase()
    
    // Step 0: Check for payment identifiers (HIGHEST PRIORITY - case-insensitive)
    for (const [identifier, member] of paymentIdMap.entries()) {
      if (descriptionLower.includes(identifier) || txnNameLower.includes(identifier)) {
        return {
          memberId: member.id,
          memberName: member.name,
          matchType: 'payment_identifier' as const,
          confidence: 'high' as const
        }
      }
    }
    
    // Step 1: Check for member_id in description (with zero-padding)
    for (const [memberId, member] of memberIdMap.entries()) {
      const memberIdStr = String(memberId).trim()
      
      // Handle alphanumeric IDs like A05, A5, A005
      const alphaMatch = memberIdStr.match(/^([A-Z]+)(\d+)$/i)
      if (alphaMatch) {
        const letter = alphaMatch[1].toUpperCase()
        const number = alphaMatch[2]
        
        // Generate all zero-padding variations
        const variations = new Set<string>()
        variations.add(`${letter}${number}`)
        variations.add(`${letter}${number.padStart(2, '0')}`)
        variations.add(`${letter}${number.padStart(3, '0')}`)
        variations.add(`${letter}${number.padStart(4, '0')}`)
        
        for (const variant of variations) {
          const regex = new RegExp(variant, 'i')
          if (regex.test(txn.description)) {
            return {
              memberId: member.id,
              memberName: member.name,
              matchType: 'member_id' as const,
              confidence: 'high' as const
            }
          }
        }
      } else {
        // For non-alphanumeric member IDs, use word boundary
        const regex = new RegExp(`\\b${memberIdStr}\\b`, 'i')
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
    
    // Step 2: Check for phone number in description
    for (const member of allMembers) {
      if (member.phone) {
        const cleanPhone = member.phone.replace(/\D/g, '')
        if (cleanPhone.length >= 9) {
          const last9 = cleanPhone.slice(-9)
          if (txn.description.includes(last9)) {
            return {
              memberId: member.id,
              memberName: member.name,
              matchType: 'phone' as const,
              confidence: 'high' as const
            }
          }
        }
        if (txn.description.includes(cleanPhone)) {
          return {
            memberId: member.id,
            memberName: member.name,
            matchType: 'phone' as const,
            confidence: 'medium' as const
          }
        }
      }
    }
    
    // Step 2: Check for phone identifier in description
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

