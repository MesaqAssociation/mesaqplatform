'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  IconSearch, IconPlus, IconRefresh, IconExternalLink, 
  IconTrash, IconCheck, IconX, IconClock, IconSparkles,
  IconBuilding, IconMapPin, IconUsers, IconCalendar, IconLoader2
} from '@tabler/icons-react'
import { useToast } from '@/hooks/use-toast'

// Decode HTML entities from scraped content
function decodeHtmlEntities(text: string): string {
  if (!text) return ''
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

interface GrantSource {
  id: string
  name: string
  url: string
  source_type: string
  entity?: string
  is_active: boolean
  last_checked_at?: string
  keywords?: string[]
  notes?: string
}

interface DiscoveredGrant {
  id: string
  title: string
  description?: string
  url?: string
  opens_at?: string
  closes_at?: string
  grant_amount?: string
  ai_eligibility_score?: number
  ai_eligibility_reason?: string
  is_eligible?: boolean
  is_notified?: boolean
  first_seen_at: string
  source_name: string
  source_entity?: string
}

interface CommunityProfile {
  member_count?: string
  locations?: string
  community_type?: string
  activities?: string
  organization_type?: string
  state?: string
  local_councils?: string
}

export function GrantsClient() {
  const [sources, setSources] = useState<GrantSource[]>([])
  const [grants, setGrants] = useState<DiscoveredGrant[]>([])
  const [profile, setProfile] = useState<CommunityProfile>({})
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [showAddSource, setShowAddSource] = useState(false)
  const [newSource, setNewSource] = useState({ name: '', url: '', entity: '', keywords: '' })
  const { toast } = useToast()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [sourcesRes, grantsRes, profileRes] = await Promise.all([
        fetch('/api/grants?type=sources'),
        fetch('/api/grants?type=discovered'),
        fetch('/api/grants?type=profile'),
      ])

      if (sourcesRes.ok) {
        const data = await sourcesRes.json()
        setSources(data.sources || [])
      }

      if (grantsRes.ok) {
        const data = await grantsRes.json()
        setGrants(data.grants || [])
      }

      if (profileRes.ok) {
        const data = await profileRes.json()
        setProfile(data.profile || {})
      }
    } catch (err) {
      console.error('Error fetching grants data:', err)
    }
    setLoading(false)
  }

  async function checkForGrants() {
    setChecking(true)
    try {
      const res = await fetch('/api/cron/check-grants', { method: 'POST' })
      const data = await res.json()

      if (res.ok) {
        toast({
          title: 'Grant Check Complete',
          description: `Checked ${data.sourcesChecked} sources. Found ${data.newGrants} new grants (${data.eligibleGrants} eligible).`,
        })
        fetchData()
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to check grants',
          variant: 'destructive',
        })
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to check grants',
        variant: 'destructive',
      })
    }
    setChecking(false)
  }

  async function addSource() {
    if (!newSource.name || !newSource.url) {
      toast({ title: 'Error', description: 'Name and URL are required', variant: 'destructive' })
      return
    }

    try {
      const res = await fetch('/api/grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSource.name,
          url: newSource.url,
          entity: newSource.entity,
          keywords: newSource.keywords.split(',').map(k => k.trim()).filter(Boolean),
        }),
      })

      if (res.ok) {
        toast({ title: 'Success', description: 'Grant source added' })
        setNewSource({ name: '', url: '', entity: '', keywords: '' })
        setShowAddSource(false)
        fetchData()
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to add source', variant: 'destructive' })
    }
  }

  async function toggleSource(id: string, isActive: boolean) {
    try {
      await fetch('/api/grants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: id, is_active: isActive }),
      })
      fetchData()
    } catch (err) {
      console.error('Error toggling source:', err)
    }
  }

  async function deleteSource(id: string) {
    if (!confirm('Delete this grant source?')) return

    try {
      await fetch(`/api/grants?id=${id}`, { method: 'DELETE' })
      fetchData()
    } catch (err) {
      console.error('Error deleting source:', err)
    }
  }

  async function updateProfile() {
    setSavingProfile(true)
    try {
      const res = await fetch('/api/grants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'profile', profile }),
      })
      if (res.ok) {
        toast({ title: 'Profile Saved', description: 'Community profile updated successfully' })
      } else {
        throw new Error('Failed to save')
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update profile', variant: 'destructive' })
    } finally {
      setSavingProfile(false)
    }
  }

  function getScoreColor(score?: number) {
    if (!score) return 'bg-muted text-muted-foreground'
    if (score >= 80) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    if (score >= 60) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  }

  function getSourceTypeBadge(type: string) {
    const colors: Record<string, string> = {
      federal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      state: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      local: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      smartygrants: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    }
    return colors[type] || 'bg-muted text-muted-foreground'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Grant Monitoring</h1>
          <p className="text-muted-foreground">Monitor and discover grant opportunities for the community</p>
        </div>
        <Button onClick={checkForGrants} disabled={checking}>
          {checking ? (
            <>
              <IconRefresh className="mr-2 h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <IconSearch className="mr-2 h-4 w-4" />
              Check Now
            </>
          )}
        </Button>
      </div>

          <Tabs defaultValue="discovered" className="space-y-4">
            <TabsList>
              <TabsTrigger value="discovered">Discovered Grants</TabsTrigger>
              <TabsTrigger value="sources">Sources ({sources.length})</TabsTrigger>
              <TabsTrigger value="profile">Community Profile</TabsTrigger>
            </TabsList>

            {/* Discovered Grants Tab */}
            <TabsContent value="discovered" className="space-y-4">
              {grants.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <IconSparkles className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Grants Discovered Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Click "Check Now" to scan all configured sources for grant opportunities.
                    </p>
                    <Button onClick={checkForGrants} disabled={checking}>
                      <IconSearch className="mr-2 h-4 w-4" />
                      Start First Scan
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {grants.map(grant => (
                    <Card key={grant.id} className={grant.is_eligible ? 'border-l-4 border-l-primary' : ''}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">{decodeHtmlEntities(grant.title)}</h3>
                              {grant.is_eligible && (
                                <Badge variant="outline">
                                  <IconCheck className="h-3 w-3 mr-1" />
                                  Eligible
                                </Badge>
                              )}
                              {grant.is_notified && (
                                <Badge variant="outline" className="text-xs">Notified</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {decodeHtmlEntities(grant.source_name)} {grant.source_entity && `• ${decodeHtmlEntities(grant.source_entity)}`}
                            </p>
                            {grant.description && (
                              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{decodeHtmlEntities(grant.description)}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <IconCalendar className="h-3 w-3" />
                                Seen: {new Date(grant.first_seen_at).toLocaleDateString()}
                              </span>
                              {grant.closes_at && (
                                <span className="flex items-center gap-1 text-orange-600">
                                  <IconClock className="h-3 w-3" />
                                  Closes: {grant.closes_at}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 ml-4">
                            {grant.ai_eligibility_score !== undefined && (
                              <Badge className={getScoreColor(grant.ai_eligibility_score)}>
                                Score: {grant.ai_eligibility_score}%
                              </Badge>
                            )}
                            {grant.url && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(grant.url, '_blank')}
                              >
                                <IconExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {grant.ai_eligibility_reason && (
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            {grant.ai_eligibility_reason.startsWith('Matched:') 
                              ? `Rule-based: ${grant.ai_eligibility_reason}` 
                              : `AI: ${grant.ai_eligibility_reason}`}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Sources Tab */}
            <TabsContent value="sources" className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setShowAddSource(!showAddSource)}>
                  <IconPlus className="mr-2 h-4 w-4" />
                  Add Source
                </Button>
              </div>

              {showAddSource && (
                <Card>
                  <CardHeader>
                    <CardTitle>Add New Grant Source</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label>Name *</Label>
                        <Input
                          value={newSource.name}
                          onChange={e => setNewSource({ ...newSource, name: e.target.value })}
                          placeholder="e.g., City of Casey Grants"
                        />
                      </div>
                      <div>
                        <Label>URL *</Label>
                        <Input
                          value={newSource.url}
                          onChange={e => setNewSource({ ...newSource, url: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>
                      <div>
                        <Label>Entity</Label>
                        <Input
                          value={newSource.entity}
                          onChange={e => setNewSource({ ...newSource, entity: e.target.value })}
                          placeholder="e.g., City of Casey"
                        />
                      </div>
                      <div>
                        <Label>Keywords (comma-separated)</Label>
                        <Input
                          value={newSource.keywords}
                          onChange={e => setNewSource({ ...newSource, keywords: e.target.value })}
                          placeholder="community, multicultural, events"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addSource}>Add Source</Button>
                      <Button variant="outline" onClick={() => setShowAddSource(false)}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4">
                {sources.map(source => (
                  <Card key={source.id} className={!source.is_active ? 'opacity-60' : ''}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{source.name}</h3>
                            <Badge className={getSourceTypeBadge(source.source_type)}>
                              {source.source_type}
                            </Badge>
                          </div>
                          {source.entity && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <IconBuilding className="h-3 w-3" />
                              {source.entity}
                            </p>
                          )}
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            {source.url}
                            <IconExternalLink className="h-3 w-3" />
                          </a>
                          {source.keywords && source.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {source.keywords.map((kw, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{kw}</Badge>
                              ))}
                            </div>
                          )}
                          {source.last_checked_at && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Last checked: {new Date(source.last_checked_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={source.is_active}
                            onCheckedChange={checked => toggleSource(source.id, checked)}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => deleteSource(source.id)}
                          >
                            <IconTrash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Community Profile Tab */}
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>Community Profile</CardTitle>
                  <CardDescription>
                    This information is used to determine grant eligibility
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="flex items-center gap-1">
                        <IconUsers className="h-4 w-4" />
                        Member Count
                      </Label>
                      <Input
                        value={profile.member_count || ''}
                        onChange={e => setProfile({ ...profile, member_count: e.target.value })}
                        placeholder="e.g., 60"
                      />
                    </div>
                    <div>
                      <Label className="flex items-center gap-1">
                        <IconMapPin className="h-4 w-4" />
                        Locations
                      </Label>
                      <Input
                        value={profile.locations || ''}
                        onChange={e => setProfile({ ...profile, locations: e.target.value })}
                        placeholder="e.g., Dandenong, Narre Warren"
                      />
                    </div>
                    <div>
                      <Label>Community Type</Label>
                      <Input
                        value={profile.community_type || ''}
                        onChange={e => setProfile({ ...profile, community_type: e.target.value })}
                        placeholder="e.g., Multicultural community association"
                      />
                    </div>
                    <div>
                      <Label>Organization Type</Label>
                      <Input
                        value={profile.organization_type || ''}
                        onChange={e => setProfile({ ...profile, organization_type: e.target.value })}
                        placeholder="e.g., Not-for-profit"
                      />
                    </div>
                    <div>
                      <Label>State</Label>
                      <Input
                        value={profile.state || ''}
                        onChange={e => setProfile({ ...profile, state: e.target.value })}
                        placeholder="e.g., Victoria"
                      />
                    </div>
                    <div>
                      <Label>Local Councils</Label>
                      <Input
                        value={profile.local_councils || ''}
                        onChange={e => setProfile({ ...profile, local_councils: e.target.value })}
                        placeholder="e.g., City of Casey, City of Greater Dandenong"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Activities</Label>
                      <Input
                        value={profile.activities || ''}
                        onChange={e => setProfile({ ...profile, activities: e.target.value })}
                        placeholder="e.g., Community gatherings, cultural events, religious observances"
                      />
                    </div>
                  </div>
                  <Button onClick={updateProfile} disabled={savingProfile}>
                    {savingProfile ? (
                      <>
                        <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Profile'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
      </Tabs>
    </div>
  )
}

