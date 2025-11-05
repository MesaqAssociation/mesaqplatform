import OpenAI from 'openai'

type UnmatchedTransaction = {
  id: string
  date: string
  description: string
  amount: number
}

type UnpaidMember = {
  id: string
  member_id: number
  name: string
  phone: string
  email: string | null
  banking_name: string | null
  address: string | null
}

type AIMatchResult = {
  transaction_id: string
  user_id: string
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
}

export async function matchTransactionsWithAI(
  unmatchedTransactions: UnmatchedTransaction[],
  unpaidMembers: UnpaidMember[],
  monthlyFee: number
): Promise<AIMatchResult[]> {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not found in environment variables')
    return []
  }

  if (unmatchedTransactions.length === 0 || unpaidMembers.length === 0) {
    return []
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  const prompt = `You are an expert at matching bank transactions to members for a community association membership payment system.

MONTHLY MEMBERSHIP FEE: $${monthlyFee.toFixed(2)}

UNPAID MEMBERS (who still need to pay):
${unpaidMembers.map((m, i) => `
${i + 1}. Member ID: ${m.member_id}
   User ID: ${m.id}
   Name: ${m.name}
   Phone: ${m.phone}
   Email: ${m.email || 'N/A'}
   Banking Name: ${m.banking_name || 'N/A'}
   Address: ${m.address || 'N/A'}
`).join('\n')}

UNMATCHED TRANSACTIONS (need to be identified):
${unmatchedTransactions.map((t, i) => `
${i + 1}. Transaction ID: ${t.id}
   Date: ${t.date}
   Amount: $${t.amount.toFixed(2)}
   Description: ${t.description}
`).join('\n')}

TASK:
Match transactions to members based on:
1. Amount matching the monthly fee ($${monthlyFee.toFixed(2)})
2. Name similarities in description (full name, first name, last name, nicknames)
3. Banking name matches
4. Phone number patterns (even partial)
5. Email username patterns
6. Address references
7. Common payment reference patterns (member ID, initials, etc.)

IMPORTANT RULES:
- Only match transactions that are EXACTLY $${monthlyFee.toFixed(2)} or very close (within $0.50)
- Each transaction should match only ONE member
- Each member should match only ONE transaction
- Be conservative - only suggest matches you're confident about
- Provide reasoning for each match

OUTPUT FORMAT (JSON only, no other text):
{
  "matches": [
    {
      "transaction_id": "uuid-here",
      "user_id": "uuid-here",
      "confidence": "high|medium|low",
      "reasoning": "Brief explanation of why this match makes sense"
    }
  ]
}

If no confident matches found, return: {"matches": []}

Respond with ONLY valid JSON, no markdown, no explanations outside the JSON.`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // Latest model, no token limit needed
      messages: [
        {
          role: 'system',
          content: 'You are a precise financial transaction matching assistant. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent results
      response_format: { type: 'json_object' }, // Ensures JSON response
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      console.error('No response from OpenAI')
      return []
    }

    const result = JSON.parse(responseText)
    
    // Validate the response structure
    if (!result.matches || !Array.isArray(result.matches)) {
      console.error('Invalid response structure from OpenAI:', result)
      return []
    }

    // Filter to only high and medium confidence matches
    const validMatches = result.matches.filter((match: any) => 
      match.transaction_id && 
      match.user_id && 
      match.confidence &&
      ['high', 'medium'].includes(match.confidence) &&
      match.reasoning
    )

    console.log(`AI found ${validMatches.length} confident matches out of ${result.matches.length} total suggestions`)
    
    return validMatches

  } catch (error) {
    console.error('Error calling OpenAI API:', error)
    return []
  }
}

