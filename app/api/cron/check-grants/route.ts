/**
 * Cron Job: Check for New Grants
 * 
 * This endpoint is called by a cron scheduler to:
 * 1. Scrape all active grant sources
 * 2. Identify new grants not seen before
 * 3. Check eligibility using AI
 * 4. Alert managers via WhatsApp if eligible grants found
 * 
 * Schedule: Daily at 9 AM
 * Vercel Cron: 0 9 * * *
 */

import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { scrapeGrantSource, matchesKeywords, ScrapedGrant, GrantSource } from '@/lib/grant-scraper'
import { getCommunityProfile, checkEligibilityWithAI } from '@/lib/grant-eligibility'
import { sendBulkAdminMessages } from '@/lib/picky-assist'

export const runtime = 'nodejs'
export const maxDuration = 60 // Allow up to 60 seconds for scraping

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

interface DiscoveredGrant extends ScrapedGrant {
  sourceId: string
  sourceName: string
  entity?: string
}

export async function GET(req: NextRequest) {
  // Verify cron secret or allow in development
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow without auth in development or if no secret set
    if (process.env.NODE_ENV === 'production' && cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  
  console.log('🔍 Starting grant check cron job...')
  
  try {
    // 1. Get all active grant sources
    const { rows: sources } = await pool.query(`
      SELECT id, name, url, source_type, entity, keywords, last_checked_at
      FROM grant_sources
      WHERE is_active = true
    `)
    
    if (sources.length === 0) {
      return NextResponse.json({ 
        message: 'No active grant sources configured',
        newGrants: 0 
      })
    }
    
    console.log(`📋 Found ${sources.length} active grant sources`)
    
    // 2. Scrape each source
    const allNewGrants: DiscoveredGrant[] = []
    
    for (const source of sources) {
      try {
        const grants = await scrapeGrantSource(source as GrantSource)
        console.log(`   → ${source.name}: Found ${grants.length} grants`)
        
        // Filter by keywords
        const keywords = source.keywords || []
        const relevantGrants = grants.filter(g => 
          keywords.length === 0 || matchesKeywords(g, keywords)
        )
        
        // Check if grant already exists in database
        for (const grant of relevantGrants) {
          const { rows: existing } = await pool.query(`
            SELECT id FROM discovered_grants 
            WHERE source_id = $1 AND title = $2
          `, [source.id, grant.title])
          
          if (existing.length === 0) {
            allNewGrants.push({
              ...grant,
              sourceId: source.id,
              sourceName: source.name,
              entity: source.entity,
            })
          }
        }
        
        // Update last_checked_at
        await pool.query(`
          UPDATE grant_sources SET last_checked_at = NOW() WHERE id = $1
        `, [source.id])
        
      } catch (err) {
        console.error(`Error scraping ${source.name}:`, err)
      }
    }
    
    console.log(`🆕 Found ${allNewGrants.length} new grants`)
    
    if (allNewGrants.length === 0) {
      return NextResponse.json({ 
        message: 'No new grants found',
        sourcesChecked: sources.length,
        newGrants: 0 
      })
    }
    
    // 3. Check eligibility for each new grant
    const profile = await getCommunityProfile()
    const eligibleGrants: DiscoveredGrant[] = []
    
    for (const grant of allNewGrants) {
      const eligibility = await checkEligibilityWithAI(
        grant.title,
        grant.description,
        grant.entity,
        profile
      )
      
      // Save to database
      await pool.query(`
        INSERT INTO discovered_grants (
          source_id, title, description, url, closes_at, 
          ai_eligibility_score, ai_eligibility_reason, is_eligible, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        grant.sourceId,
        grant.title,
        grant.description,
        grant.url,
        grant.closesAt,
        eligibility.score,
        eligibility.reason,
        eligibility.isEligible,
        JSON.stringify(grant.rawData || {}),
      ])
      
      if (eligibility.isEligible) {
        eligibleGrants.push(grant)
      }
      
      console.log(`   → ${grant.title}: Score ${eligibility.score} (${eligibility.isEligible ? '✅ Eligible' : '❌ Not eligible'})`)
    }
    
    console.log(`✅ ${eligibleGrants.length} grants are potentially eligible`)
    
    // 4. Send WhatsApp notification to managers if eligible grants found
    if (eligibleGrants.length > 0) {
      await notifyManagers(eligibleGrants)
    }
    
    return NextResponse.json({
      message: 'Grant check completed',
      sourcesChecked: sources.length,
      newGrants: allNewGrants.length,
      eligibleGrants: eligibleGrants.length,
      grants: eligibleGrants.map(g => ({
        title: g.title,
        source: g.sourceName,
        url: g.url,
      })),
    })
    
  } catch (err: any) {
    console.error('Grant check cron error:', err)
    return NextResponse.json({ 
      error: 'Grant check failed',
      details: err.message 
    }, { status: 500 })
  }
}

/**
 * Send WhatsApp notification to managers about new eligible grants
 */
async function notifyManagers(grants: DiscoveredGrant[]) {
  try {
    // Get managers
    const { rows: managers } = await pool.query(`
      SELECT id, name, phone FROM users 
      WHERE LOWER(role) IN ('admin', 'manager', 'head')
      AND phone IS NOT NULL
    `)
    
    if (managers.length === 0) {
      console.log('⚠️ No managers to notify')
      return
    }
    
    // Build message
    const grantList = grants.slice(0, 5).map((g, i) => 
      `${i + 1}. ${g.title} (${g.sourceName})`
    ).join('\n')
    
    const moreText = grants.length > 5 ? `\n...and ${grants.length - 5} more` : ''
    
    const message = `🎯 New Grant Opportunities Found!\n\n${grantList}${moreText}\n\nLog in to the dashboard to view details and check eligibility.`
    
    // Prepare recipients
    const recipients = managers.map(m => ({
      phone: m.phone,
      name: m.name,
    }))
    
    // Send via Picky Assist
    const isTestMode = process.env.PICKY_ASSIST_TEST_MODE === 'true'
    const testNumber = process.env.WHATSAPP_TEST_NUMBER
    
    if (isTestMode && testNumber) {
      console.log(`📱 [TEST MODE] Would send to: ${recipients.map(r => r.name).join(', ')}`)
      console.log(`📱 [TEST MODE] Sending to test number: ${testNumber}`)
      
      await sendBulkAdminMessages(
        [{ phone: testNumber, name: 'Test' }],
        message,
        isTestMode,
        testNumber
      )
    } else {
      await sendBulkAdminMessages(recipients, message, false)
    }
    
    // Mark grants as notified
    for (const grant of grants) {
      await pool.query(`
        UPDATE discovered_grants 
        SET is_notified = true, notified_at = NOW()
        WHERE source_id = $1 AND title = $2
      `, [grant.sourceId, grant.title])
    }
    
    console.log(`📱 Notified ${managers.length} manager(s) about ${grants.length} grants`)
    
  } catch (err) {
    console.error('Error notifying managers:', err)
  }
}

// Also allow POST for manual triggers
export async function POST(req: NextRequest) {
  return GET(req)
}

