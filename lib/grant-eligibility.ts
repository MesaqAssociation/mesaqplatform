/**
 * Grant Eligibility Checker
 * 
 * Uses AI to determine if a grant is suitable for the community
 */

import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export interface CommunityProfile {
  memberCount: string
  locations: string
  communityType: string
  activities: string
  organizationType: string
  state: string
  localCouncils: string
}

export interface EligibilityResult {
  score: number // 0-100
  isEligible: boolean
  reason: string
}

/**
 * Get community profile from database
 */
export async function getCommunityProfile(): Promise<CommunityProfile> {
  try {
    const { rows } = await pool.query('SELECT profile_key, profile_value FROM community_profile')
    
    const profile: Record<string, string> = {}
    for (const row of rows) {
      profile[row.profile_key] = row.profile_value
    }
    
    return {
      memberCount: profile['member_count'] || '60',
      locations: profile['locations'] || 'Dandenong, Narre Warren, Hallam, Berwick',
      communityType: profile['community_type'] || 'Multicultural community association',
      activities: profile['activities'] || 'Community gatherings, cultural events',
      organizationType: profile['organization_type'] || 'Not-for-profit community organization',
      state: profile['state'] || 'Victoria',
      localCouncils: profile['local_councils'] || 'City of Casey, City of Greater Dandenong',
    }
  } catch (error) {
    console.error('Error fetching community profile:', error)
    // Return defaults
    return {
      memberCount: '60',
      locations: 'Dandenong, Narre Warren, Hallam, Berwick',
      communityType: 'Multicultural community association',
      activities: 'Community gatherings, cultural events, religious observances',
      organizationType: 'Not-for-profit community organization',
      state: 'Victoria',
      localCouncils: 'City of Casey, City of Greater Dandenong',
    }
  }
}

/**
 * Check grant eligibility using OpenAI API
 */
export async function checkEligibilityWithAI(
  grantTitle: string,
  grantDescription: string | undefined,
  grantEntity: string | undefined,
  profile: CommunityProfile
): Promise<EligibilityResult> {
  
  // If no OpenAI API key, use rule-based checking
  if (!process.env.OPENAI_API_KEY) {
    return checkEligibilityRuleBased(grantTitle, grantDescription, grantEntity, profile)
  }
  
  try {
    const prompt = `You are an expert in Australian community grants. Evaluate if this grant is suitable for the following community organization.

GRANT INFORMATION:
- Title: ${grantTitle}
- Description: ${grantDescription || 'No description available'}
- Funding Entity: ${grantEntity || 'Unknown'}

COMMUNITY PROFILE:
- Type: ${profile.communityType}
- Organization Type: ${profile.organizationType}
- Member Count: ${profile.memberCount}
- Location: ${profile.locations}
- State: ${profile.state}
- Local Councils: ${profile.localCouncils}
- Activities: ${profile.activities}

Respond with a JSON object containing:
1. "score": A number from 0-100 indicating eligibility likelihood (100 = highly eligible, 0 = not eligible)
2. "isEligible": true if score >= 60, false otherwise
3. "reason": A brief explanation (1-2 sentences) of why this grant is or isn't suitable

Consider:
- Geographic eligibility (local council area, state)
- Organization type requirements
- Grant purpose alignment with community activities
- Any obvious exclusion criteria

JSON response only:`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a grant eligibility expert. Respond only with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    })
    
    if (!response.ok) {
      console.error('OpenAI API error:', await response.text())
      return checkEligibilityRuleBased(grantTitle, grantDescription, grantEntity, profile)
    }
    
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0])
      return {
        score: Math.min(100, Math.max(0, result.score || 0)),
        isEligible: result.isEligible ?? (result.score >= 60),
        reason: result.reason || 'AI evaluation completed',
      }
    }
    
    // Fallback if JSON parsing fails
    return checkEligibilityRuleBased(grantTitle, grantDescription, grantEntity, profile)
    
  } catch (error) {
    console.error('AI eligibility check error:', error)
    return checkEligibilityRuleBased(grantTitle, grantDescription, grantEntity, profile)
  }
}

/**
 * Rule-based eligibility check (fallback when AI unavailable)
 */
export function checkEligibilityRuleBased(
  grantTitle: string,
  grantDescription: string | undefined,
  grantEntity: string | undefined,
  profile: CommunityProfile
): EligibilityResult {
  const searchText = `${grantTitle} ${grantDescription || ''} ${grantEntity || ''}`.toLowerCase()
  
  let score = 50 // Start neutral
  const reasons: string[] = []
  
  // Positive signals
  if (searchText.includes('multicultural') || searchText.includes('diverse')) {
    score += 20
    reasons.push('multicultural focus')
  }
  
  if (searchText.includes('community')) {
    score += 10
    reasons.push('community-oriented')
  }
  
  if (searchText.includes('not-for-profit') || searchText.includes('nonprofit')) {
    score += 10
    reasons.push('NFP eligible')
  }
  
  // Local council match
  const localCouncils = profile.localCouncils.toLowerCase()
  if (grantEntity?.toLowerCase().includes('casey') && localCouncils.includes('casey')) {
    score += 15
    reasons.push('local council match (Casey)')
  }
  if (grantEntity?.toLowerCase().includes('dandenong') && localCouncils.includes('dandenong')) {
    score += 15
    reasons.push('local council match (Greater Dandenong)')
  }
  
  // State match
  if (searchText.includes('victoria') || searchText.includes('victorian')) {
    score += 10
    reasons.push('Victoria-based')
  }
  
  // Activity match
  if (searchText.includes('event') || searchText.includes('gathering') || searchText.includes('festival')) {
    score += 10
    reasons.push('event/gathering funding')
  }
  
  // Negative signals
  if (searchText.includes('business') && !searchText.includes('not-for-profit')) {
    score -= 15
    reasons.push('may be business-focused')
  }
  
  if (searchText.includes('individual') && !searchText.includes('group')) {
    score -= 10
    reasons.push('may be for individuals')
  }
  
  // Cap score
  score = Math.min(100, Math.max(0, score))
  
  return {
    score,
    isEligible: score >= 60,
    reason: reasons.length > 0 
      ? `Matched: ${reasons.join(', ')}` 
      : 'General community grant - review required',
  }
}

