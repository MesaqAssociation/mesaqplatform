/**
 * Grant Scraper Utility
 * 
 * Scrapes various grant sources for new opportunities
 */

export interface ScrapedGrant {
  title: string
  description?: string
  url?: string
  opensAt?: string
  closesAt?: string
  grantAmount?: string
  eligibilityNotes?: string
  rawData?: Record<string, any>
}

export interface GrantSource {
  id: string
  name: string
  url: string
  source_type: string
  entity?: string
  keywords?: string[]
}

/**
 * Scrape SmartyGrants portal (Casey, Greater Dandenong, etc.)
 * These have structured HTML that's easier to parse
 */
export async function scrapeSmartyGrants(url: string): Promise<ScrapedGrant[]> {
  const grants: ScrapedGrant[] = []
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MesaqGrantMonitor/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    
    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`)
      return grants
    }
    
    const html = await response.text()
    
    // Parse SmartyGrants page structure
    // Look for grant round titles and details
    const roundMatches = html.matchAll(/<h3[^>]*>(.*?)<\/h3>[\s\S]*?<p[^>]*>(.*?)<\/p>/gi)
    
    for (const match of roundMatches) {
      const title = match[1]?.replace(/<[^>]*>/g, '').trim()
      const description = match[2]?.replace(/<[^>]*>/g, '').trim()
      
      if (title && !title.includes('Log in') && !title.includes('Contact')) {
        // Extract closing date if present
        const closeDateMatch = description?.match(/close[sd]?\s+(?:midnight\s+)?(\d{1,2}\s+\w+\s+\d{4})/i)
        
        grants.push({
          title,
          description,
          url: url,
          closesAt: closeDateMatch ? closeDateMatch[1] : undefined,
          rawData: { source: 'smartygrants', html: match[0] }
        })
      }
    }
    
    // Also try to find links to specific grant rounds
    const linkMatches = html.matchAll(/href="([^"]*)"[^>]*>(?:Find out more about|Apply for)\s*(.*?)\.\.\./gi)
    for (const match of linkMatches) {
      const grantUrl = match[1].startsWith('http') ? match[1] : `${url}${match[1]}`
      const title = match[2]?.trim()
      
      if (title && !grants.find(g => g.title === title)) {
        grants.push({
          title,
          url: grantUrl,
          rawData: { source: 'smartygrants_link' }
        })
      }
    }
    
  } catch (error) {
    console.error(`Error scraping SmartyGrants ${url}:`, error)
  }
  
  return grants
}

/**
 * Scrape Victorian Government grant pages
 */
export async function scrapeVicGov(url: string): Promise<ScrapedGrant[]> {
  const grants: ScrapedGrant[] = []
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MesaqGrantMonitor/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    
    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`)
      return grants
    }
    
    const html = await response.text()
    
    // Look for grant listings - vic.gov.au uses specific patterns
    // Look for card/list items with grant information
    const cardMatches = html.matchAll(/<(?:article|div)[^>]*class="[^"]*card[^"]*"[^>]*>[\s\S]*?<h[23][^>]*>(.*?)<\/h[23]>[\s\S]*?<p[^>]*>(.*?)<\/p>/gi)
    
    for (const match of cardMatches) {
      const title = match[1]?.replace(/<[^>]*>/g, '').trim()
      const description = match[2]?.replace(/<[^>]*>/g, '').trim()
      
      if (title && title.toLowerCase().includes('grant')) {
        grants.push({
          title,
          description,
          url: url,
          rawData: { source: 'vic_gov' }
        })
      }
    }
    
    // Also look for list items with grant mentions
    const listMatches = html.matchAll(/<li[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<\/li>/gi)
    for (const match of listMatches) {
      const title = match[2]?.replace(/<[^>]*>/g, '').trim()
      
      if (title && (title.toLowerCase().includes('grant') || title.toLowerCase().includes('fund'))) {
        const grantUrl = match[1].startsWith('http') ? match[1] : `https://www.vic.gov.au${match[1]}`
        
        if (!grants.find(g => g.title === title)) {
          grants.push({
            title,
            url: grantUrl,
            rawData: { source: 'vic_gov_list' }
          })
        }
      }
    }
    
  } catch (error) {
    console.error(`Error scraping Vic Gov ${url}:`, error)
  }
  
  return grants
}

/**
 * Scrape generic grant page (fallback)
 */
export async function scrapeGenericPage(url: string, keywords: string[]): Promise<ScrapedGrant[]> {
  const grants: ScrapedGrant[] = []
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MesaqGrantMonitor/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    
    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`)
      return grants
    }
    
    const html = await response.text()
    
    // Extract page title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
    const pageTitle = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : 'Unknown'
    
    // Look for any heading that mentions grants/funding
    const headingMatches = html.matchAll(/<h[1-4][^>]*>(.*?)<\/h[1-4]>/gi)
    
    for (const match of headingMatches) {
      const heading = match[1]?.replace(/<[^>]*>/g, '').trim().toLowerCase()
      
      // Check if heading contains relevant keywords
      const isRelevant = keywords.some(kw => heading.includes(kw.toLowerCase())) ||
                         heading.includes('grant') ||
                         heading.includes('fund') ||
                         heading.includes('program')
      
      if (isRelevant && match[1]) {
        grants.push({
          title: match[1].replace(/<[^>]*>/g, '').trim(),
          url: url,
          rawData: { source: 'generic', pageTitle }
        })
      }
    }
    
  } catch (error) {
    console.error(`Error scraping generic page ${url}:`, error)
  }
  
  return grants
}

/**
 * Main scraper function - routes to appropriate scraper based on source type
 */
export async function scrapeGrantSource(source: GrantSource): Promise<ScrapedGrant[]> {
  console.log(`🔍 Scraping: ${source.name} (${source.url})`)
  
  const url = source.url
  const keywords = source.keywords || []
  
  // Route to appropriate scraper based on source type or URL
  if (source.source_type === 'smartygrants' || url.includes('smartygrants.com.au')) {
    return scrapeSmartyGrants(url)
  }
  
  if (url.includes('vic.gov.au')) {
    return scrapeVicGov(url)
  }
  
  // For federal sites and others, use generic scraper
  return scrapeGenericPage(url, keywords)
}

/**
 * Check if a grant matches the community's keywords
 */
export function matchesKeywords(grant: ScrapedGrant, keywords: string[]): boolean {
  const searchText = `${grant.title} ${grant.description || ''}`.toLowerCase()
  
  return keywords.some(keyword => searchText.includes(keyword.toLowerCase()))
}

