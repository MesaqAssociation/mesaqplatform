"use client"

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import MembersClient from './MembersClient'
import { IconX, IconPlus, IconUsers } from '@tabler/icons-react'
import { useI18n } from '@/components/I18nProvider'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
  const [groupDescription, setGroupDescription] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [creatingGroup, setCreatingGroup] = useState(false)

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
          description: groupDescription.trim() || null,
          memberIds: selectedMembers.length > 0 ? selectedMembers : undefined
        })
      })
      
      const data = await res.json()
      
      if (res.ok) {
        toast('Group created successfully!', 'success')
        setShowGroupDialog(false)
        setGroupName('')
        setGroupDescription('')
        setSelectedMembers([])
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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">{t("members")}</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowGroupDialog(true)}>
              <IconUsers className="mr-2 size-4" />
              Create Group
            </Button>
            <Link href="/members/create">
              <Button>
                <IconPlus className="mr-2 size-4" />
                {t("createNew")}
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
              <Label htmlFor="group-description">Description (optional)</Label>
              <Input
                id="group-description"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="Optional description"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Add Members (optional)</Label>
              <div className="mt-2 max-h-48 overflow-y-auto border rounded-md p-2 space-y-2">
                {initial.map((member) => (
                  <label key={member.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                    <Checkbox
                      checked={selectedMembers.includes(member.id)}
                      onCheckedChange={() => toggleMember(member.id)}
                    />
                    <span className="text-sm">{member.name || 'Unknown'}</span>
                  </label>
                ))}
              </div>
              {selectedMembers.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedMembers.length} member(s) selected
                </p>
              )}
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowGroupDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateGroup} disabled={creatingGroup || !groupName.trim()}>
                {creatingGroup ? 'Creating...' : 'Create Group'}
              </Button>
            </div>
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

