"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { IconSend, IconUsers, IconSearch } from '@tabler/icons-react'
import { Progress } from '@/components/ui/progress'

type Member = {
  id: string
  name: string
  phone: string | null
  email: string
  member_id: number
}

export default function MessagingClient() {
  const [members, setMembers] = useState<Member[]>([])
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sendProgress, setSendProgress] = useState(0)
  const [sendStatus, setSendStatus] = useState<string>('')

  useEffect(() => {
    loadMembers()
  }, [])

  const loadMembers = async () => {
    try {
      const res = await fetch('/api/members')
      if (res.ok) {
        const data = await res.json()
        // Only show members with phone numbers
        const membersWithPhone = data.members.filter((m: Member) => m.phone && m.phone.trim() !== '')
        setMembers(membersWithPhone)
      }
    } catch (err) {
      console.error('Failed to load members:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleMember = (memberId: string) => {
    const newSelected = new Set(selectedMembers)
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId)
    } else {
      newSelected.add(memberId)
    }
    setSelectedMembers(newSelected)
  }

  const toggleAll = () => {
    if (selectedMembers.size === filteredMembers.length) {
      setSelectedMembers(new Set())
    } else {
      setSelectedMembers(new Set(filteredMembers.map(m => m.id)))
    }
  }

  const handleSend = async () => {
    if (selectedMembers.size === 0) {
      alert('Please select at least one member')
      return
    }

    if (!message.trim()) {
      alert('Please enter a message')
      return
    }

    if (!confirm(`Send message to ${selectedMembers.size} member(s)?`)) {
      return
    }

    setSending(true)
    setSendProgress(0)
    setSendStatus('Starting...')

    try {
      const res = await fetch('/api/messaging/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberIds: Array.from(selectedMembers),
          message: message.trim(),
        }),
      })

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n').filter(line => line.trim())

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.progress !== undefined) {
                  setSendProgress(data.progress)
                }
                if (data.status) {
                  setSendStatus(data.status)
                }
                if (data.complete) {
                  alert(`✅ Messages sent!\n\nSuccess: ${data.sent}\nFailed: ${data.failed}`)
                  setMessage('')
                  setSelectedMembers(new Set())
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e)
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Send error:', err)
      alert('Failed to send messages')
    } finally {
      setSending(false)
      setSendProgress(0)
      setSendStatus('')
    }
  }

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.phone && m.phone.includes(searchQuery))
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Send Messages</h1>
        <p className="text-muted-foreground mt-1">
          Send WhatsApp messages to members
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Member Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconUsers className="size-5" />
              Select Recipients
            </CardTitle>
            <CardDescription>
              Choose members to send messages to ({selectedMembers.size} selected)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Select All */}
              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox
                  id="select-all"
                  checked={selectedMembers.size === filteredMembers.length && filteredMembers.length > 0}
                  onCheckedChange={toggleAll}
                />
                <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                  Select All ({filteredMembers.length})
                </label>
              </div>

              {/* Member List */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {loading ? (
                  <p className="text-center text-muted-foreground py-4">Loading members...</p>
                ) : filteredMembers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No members found</p>
                ) : (
                  filteredMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-start gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                      onClick={() => toggleMember(member.id)}
                    >
                      <Checkbox
                        checked={selectedMembers.has(member.id)}
                        onCheckedChange={() => toggleMember(member.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{member.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {member.phone} • {member.email}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Message Composition */}
        <Card>
          <CardHeader>
            <CardTitle>Compose Message</CardTitle>
            <CardDescription>
              Write your message (sent individually to each member)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Textarea
                placeholder="Type your message here...

You can use these variables:
- {{name}} - Member's name
- {{phone}} - Member's phone
- {{email}} - Member's email"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={12}
                className="resize-none"
              />

              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">Example:</p>
                <p className="bg-muted p-2 rounded text-xs">
                  Hi {`{{name}}`}, this is a message from Mesaq Association. 
                  Your membership status is updated.
                </p>
              </div>

              {sending && (
                <div className="space-y-2">
                  <Progress value={sendProgress} />
                  <p className="text-sm text-center text-muted-foreground">{sendStatus}</p>
                </div>
              )}

              <Button 
                onClick={handleSend} 
                disabled={selectedMembers.size === 0 || !message.trim() || sending}
                className="w-full"
                size="lg"
              >
                <IconSend className="mr-2 size-4" />
                {sending ? 'Sending...' : `Send to ${selectedMembers.size} Member(s)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

