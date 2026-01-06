-- Grant Monitoring System
-- Monitors external grant sources and alerts managers of eligible opportunities

-- Table: grant_sources - URLs to monitor for new grants
CREATE TABLE IF NOT EXISTS grant_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL DEFAULT 'general', -- 'federal', 'state', 'local', 'smartygrants'
  entity TEXT, -- e.g., 'City of Casey', 'Victorian Government'
  is_active BOOLEAN DEFAULT true,
  check_frequency_hours INTEGER DEFAULT 24,
  last_checked_at TIMESTAMPTZ,
  keywords TEXT[], -- Keywords to filter grants
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: discovered_grants - Grants found from monitoring
CREATE TABLE IF NOT EXISTS discovered_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES grant_sources(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  grant_amount TEXT, -- e.g., "Up to $10,000"
  eligibility_notes TEXT,
  ai_eligibility_score INTEGER, -- 0-100 score from AI
  ai_eligibility_reason TEXT,
  is_eligible BOOLEAN, -- Final determination
  is_notified BOOLEAN DEFAULT false,
  notified_at TIMESTAMPTZ,
  raw_data JSONB, -- Store raw scraped data for reference
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: community_profile - Store community details for eligibility matching
CREATE TABLE IF NOT EXISTS community_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_key TEXT UNIQUE NOT NULL,
  profile_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default community profile
INSERT INTO community_profile (profile_key, profile_value) VALUES
  ('member_count', '60'),
  ('locations', 'Dandenong, Narre Warren, Hallam, Berwick'),
  ('community_type', 'Multicultural community association'),
  ('activities', 'Community gatherings, cultural events, religious observances'),
  ('organization_type', 'Not-for-profit community organization'),
  ('state', 'Victoria'),
  ('local_councils', 'City of Casey, City of Greater Dandenong')
ON CONFLICT (profile_key) DO UPDATE SET 
  profile_value = EXCLUDED.profile_value,
  updated_at = NOW();

-- Insert default grant sources to monitor
INSERT INTO grant_sources (name, url, source_type, entity, keywords, notes) VALUES
  (
    'GrantConnect (Federal)',
    'https://www.grants.gov.au',
    'federal',
    'Australian Government',
    ARRAY['community', 'multicultural', 'youth', 'not-for-profit', 'events', 'infrastructure'],
    'Source of truth for all Australian Government grants'
  ),
  (
    'Community Grants Hub',
    'https://www.communitygrants.gov.au',
    'federal',
    'Community Grants Hub',
    ARRAY['multicultural', 'social cohesion', 'capacity-building', 'community'],
    'Major community & multicultural programs'
  ),
  (
    'Home Affairs Multicultural Programs',
    'https://www.homeaffairs.gov.au/about-us/our-portfolios/multicultural-affairs/programs',
    'federal',
    'Department of Home Affairs',
    ARRAY['multicultural', 'grassroots', 'community'],
    'Multicultural Grassroots Grants announced here first'
  ),
  (
    'Victoria Multicultural Grants',
    'https://www.vic.gov.au/grants-support-multicultural-communities',
    'state',
    'Victorian Government',
    ARRAY['multicultural', 'infrastructure', 'festivals', 'safety', 'community development'],
    'Up to $400,000 available'
  ),
  (
    'Multicultural Affairs Victoria',
    'https://www.vic.gov.au/multicultural-affairs',
    'state',
    'Victorian Government',
    ARRAY['multicultural', 'policy', 'funding'],
    'Policy + funding announcements'
  ),
  (
    'Creative Victoria',
    'https://creative.vic.gov.au/funding',
    'state',
    'Creative Victoria',
    ARRAY['cultural', 'festivals', 'arts', 'heritage', 'events'],
    'Cultural festivals, community arts, heritage events'
  ),
  (
    'City of Casey Community Grants',
    'https://www.casey.vic.gov.au/community-grants',
    'local',
    'City of Casey',
    ARRAY['community', 'grants', 'local'],
    'Local council grants - primary page'
  ),
  (
    'City of Casey All Grants',
    'https://www.casey.vic.gov.au/grants-community',
    'local',
    'City of Casey',
    ARRAY['community', 'grants'],
    'All available Casey grants'
  ),
  (
    'Casey SmartyGrants Portal',
    'https://casey.smartygrants.com.au',
    'smartygrants',
    'City of Casey',
    ARRAY['community', 'quick response'],
    'Where grants actually open - structured data'
  ),
  (
    'Greater Dandenong SmartyGrants',
    'https://greaterdandenong.smartygrants.com.au',
    'smartygrants',
    'City of Greater Dandenong',
    ARRAY['community', 'small grants'],
    'Dandenong council grants portal'
  )
ON CONFLICT (url) DO NOTHING;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_discovered_grants_source ON discovered_grants(source_id);
CREATE INDEX IF NOT EXISTS idx_discovered_grants_notified ON discovered_grants(is_notified);
CREATE INDEX IF NOT EXISTS idx_grant_sources_active ON grant_sources(is_active);

