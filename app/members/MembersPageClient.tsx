"use client"

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import MembersClient from './MembersClient'
import { IconX, IconPlus, IconUsers, IconChevronDown, IconEye } from '@tabler/icons-react'
import { useI18n } from '@/components/I18nProvider'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { showToast as toast } from '@/lib/toast'

type Member = {
  id: string
  phone: string
  name: string | null
  email: string | null
  address: string | null
  image: string | null
  role: string | null
}

export default function MembersPageClient({ initial, isAdmin = true }: { initial: Member[], isAdmin?: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  
  // Group creation state
  const [showGroupDialog, setShowGroupDialog] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [selectedLeader, setSelectedLeader] = useState<string>('')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [additionalMemberSearchQuery, setAdditionalMemberSearchQuery] = useState('')
  
  // View groups state
  const [showViewGroupsDialog, setShowViewGroupsDialog] = useState(false)
  const [groups, setGroups] = useState<Array<{ id: string | null, name: string, member_count: number, members?: Array<{ id: string, name: string }> }>>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [openGroupId, setOpenGroupId] = useState<string | null>(null)
  const [loadingGroupMembers, setLoadingGroupMembers] = useState<string | null>(null)

  useEffect(() => {
    const success = searchParams.get('success')
    if (success) {
      setToastMessage(success)
      setShowToast(true)
      
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setShowToast(false)
      }, 5000)

      // Clean up URL
      window.history.replaceState({}, '', '/members')

      return () => clearTimeout(timer)
    }
  }, [searchParams])

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast('Please enter a group name', 'error')
      return
    }
    
    setCreatingGroup(true)
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName.trim(),
          memberIds: selectedMembers.length > 0 ? selectedMembers : undefined
        })
      })
      
      const data = await res.json()
      
      if (res.ok) {
        toast('Group created successfully!', 'success')
        setShowGroupDialog(false)
        setGroupName('')
        setSelectedMembers([])
        setSelectedLeader('')
        setMemberSearchQuery('')
        setAdditionalMemberSearchQuery('')
        router.refresh()
      } else {
        toast(data.error || 'Failed to create group', 'error')
      }
    } catch (err) {
      console.error('Create group error:', err)
      toast('Failed to create group', 'error')
    } finally {
      setCreatingGroup(false)
    }
  }

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    )
  }

  // Load groups when dialog opens
  const loadGroups = async () => {
    setLoadingGroups(true)
    try {
      const res = await fetch('/api/groups')
      if (res.ok) {
        const data = await res.json()
        setGroups(data.groups || [])
      }
    } catch (err) {
      console.error('Failed to load groups:', err)
    } finally {
      setLoadingGroups(false)
    }
  }

  // Load members for a specific group
  const loadGroupMembers = async (groupName: string, groupId: string | null) => {
    setLoadingGroupMembers(groupId || groupName)
    try {
      // Fetch from API - pass both id and name for accurate lookup
      const params = new URLSearchParams()
      if (groupId) params.append('id', groupId)
      params.append('name', groupName)
      
      const res = await fetch(`/api/groups/members?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setGroups(prev => prev.map(g => 
          (g.id === groupId || g.name === groupName) 
            ? { ...g, members: data.members } 
            : g
        ))
      }
    } catch (err) {
      console.error('Failed to load group members:', err)
    } finally {
      setLoadingGroupMembers(null)
    }
  }

  // Handle group accordion toggle
  const handleGroupToggle = (groupId: string | null, groupName: string) => {
    const key = groupId || groupName
    if (openGroupId === key) {
      setOpenGroupId(null)
    } else {
      setOpenGroupId(key)
      // Load members if not already loaded
      const group = groups.find(g => (g.id || g.name) === key)
      if (!group?.members) {
        loadGroupMembers(groupName, groupId)
      }
    }
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-semibold">{t("members")}</h1>
        {isAdmin && (
          <div className="flex flex-row gap-2 overflow-x-auto">
            <Button 
              variant="outline" 
              size="sm"
              className="whitespace-nowrap"
              onClick={() => {
                setShowViewGroupsDialog(true)
                loadGroups()
              }}
            >
              <IconEye className="mr-1 size-4" />
              <span className="hidden sm:inline">View Groups</span>
              <span className="sm:hidden">Groups</span>
            </Button>
            <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => setShowGroupDialog(true)}>
              <IconUsers className="mr-1 size-4" />
              <span className="hidden sm:inline">Create Group</span>
              <span className="sm:hidden">New Group</span>
            </Button>
        <Link href="/members/create">
              <Button size="sm" className="whitespace-nowrap">
                <IconPlus className="mr-1 size-4" />
                <span className="hidden sm:inline">{t("createNew")}</span>
                <span className="sm:hidden">New</span>
              </Button>
        </Link>
          </div>
        )}
      </div>
      <MembersClient initial={initial} isAdmin={isAdmin} />
      
      {/* Create Group Dialog */}
      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
            <DialogDescription>
              Create a group for event organization rotation. You can optionally select members to add.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="group-name">Group Name *</Label>
              <Input
                id="group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g., Group A, Group 1"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Group Leader *</Label>
              <Input
                placeholder="Search for leader..."
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                className="mt-1"
              />
              <div className="mt-2 max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                {initial
                  .filter(m => 
                    !memberSearchQuery || 
                    m.name?.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
                    m.phone?.toLowerCase().includes(memberSearchQuery.toLowerCase())
                  )
                  .map((member) => (
                    <label key={member.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded">
                      <input
                        type="radio"
                        name="leader"
                        checked={selectedLeader === member.id}
                        onChange={() => {
                          setSelectedLeader(member.id)
                          if (!selectedMembers.includes(member.id)) {
                            setSelectedMembers(prev => [...prev, member.id])
                          }
                        }}
                        className="size-4"
                      />
                      <span className="text-sm font-medium">{member.name || 'Unknown'}</span>
                    </label>
                  ))}
              </div>
              {selectedLeader && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Leader: <span className="font-medium text-foreground">{initial.find(m => m.id === selectedLeader)?.name}</span>
                </div>
              )}
            </div>

            <div>
              <Label>Add Additional Members (optional)</Label>
              <Input
                placeholder="Search members to add..."
                value={additionalMemberSearchQuery}
                onChange={(e) => setAdditionalMemberSearchQuery(e.target.value)}
                className="mt-1"
              />
              <div className="mt-2 max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                {initial
                  .filter(m => m.id !== selectedLeader)
                  .filter(m => 
                    !additionalMemberSearchQuery || 
                    m.name?.toLowerCase().includes(additionalMemberSearchQuery.toLowerCase()) ||
                    m.phone?.toLowerCase().includes(additionalMemberSearchQuery.toLowerCase())
                  )
                  .map((member) => (
                    <label key={member.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded">
                      <Checkbox
                        checked={selectedMembers.includes(member.id)}
                        onCheckedChange={() => toggleMember(member.id)}
                      />
                      <span className="text-sm">{member.name || 'Unknown'}</span>
                    </label>
                  ))}
              </div>
              {selectedMembers.filter(id => id !== selectedLeader).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedMembers.filter(id => id !== selectedLeader).map(id => {
                    const member = initial.find(m => m.id === id)
                    return (
                      <span 
                        key={id} 
                        className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
                      >
                        {member?.name || 'Unknown'}
                        <button 
                          onClick={() => toggleMember(id)} 
                          className="hover:text-destructive"
                        >
                          <IconX className="size-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowGroupDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateGroup} disabled={creatingGroup || !groupName.trim() || !selectedLeader}>
                {creatingGroup ? 'Creating...' : 'Create Group'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Groups Dialog */}
      <Dialog open={showViewGroupsDialog} onOpenChange={setShowViewGroupsDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Groups</DialogTitle>
            <DialogDescription>
              View all groups and their members. Click on a group to expand and see its members.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 mt-4">
            {loadingGroups ? (
              <div className="space-y-3">
                <div className="h-12 bg-muted/50 rounded animate-pulse" />
                <div className="h-12 bg-muted/50 rounded animate-pulse" />
                <div className="h-12 bg-muted/50 rounded animate-pulse" />
              </div>
            ) : groups.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No groups found. Create one to get started.</p>
            ) : (
              groups.map((group) => {
                const key = group.id || group.name
                const isOpen = openGroupId === key
                
                return (
                  <Collapsible
                    key={key}
                    open={isOpen}
                    onOpenChange={() => handleGroupToggle(group.id, group.name)}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <IconUsers className="size-5 text-muted-foreground" />
                          <span className="font-medium">{group.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {group.member_count || 0} member{(group.member_count || 0) !== 1 ? 's' : ''}
                          </span>
                          <IconChevronDown className={`size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-8 mt-2 space-y-1 pb-2">
                        {loadingGroupMembers === key ? (
                          <div className="space-y-2 p-2">
                            <div className="h-6 bg-muted/50 rounded animate-pulse w-32" />
                            <div className="h-6 bg-muted/50 rounded animate-pulse w-40" />
                            <div className="h-6 bg-muted/50 rounded animate-pulse w-36" />
                          </div>
                        ) : group.members && group.members.length > 0 ? (
                          group.members.map((member: any) => (
                            <div 
                              key={member.id} 
                              className="px-3 py-2 text-sm rounded hover:bg-muted/50 cursor-pointer"
                              onClick={() => router.push(`/members/${member.id}`)}
                            >
                              <span className={member.is_group_leader ? 'font-bold' : ''}>
                                {member.name || 'Unknown'}
                              </span>
                              {member.is_group_leader && (
                                <span className="ml-2 text-xs text-primary">(Leader)</span>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground px-3 py-2">No members in this group</p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {showToast && (
        <div 
          className="fixed bottom-4 right-4 bg-[#34b14e] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-md animate-in slide-in-from-right z-50"
          style={{ animation: 'slideInRight 0.3s ease-out' }}
        >
          <span className="flex-1">{toastMessage}</span>
          <button
            onClick={() => setShowToast(false)}
            className="text-white hover:text-white/80 transition-colors"
            aria-label="Close"
          >
            <IconX className="size-5" />
          </button>
        </div>
      )}
    </div>
  )
}

