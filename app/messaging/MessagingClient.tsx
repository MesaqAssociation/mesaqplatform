"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { IconSend, IconUsers, IconSearch, IconMessage, IconRefresh } from '@tabler/icons-react'
import { Progress } from '@/components/ui/progress'
import { showToast } from '@/lib/toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Member = {
  id: string
  name: string
  phone: string | null
  email: string
  member_id: string
}

type IncomingMessage = {
  id: string
  phone: string
  message: string
  contactName: string | null
  timestamp: string
  type: string
  read: boolean
  memberId: string | null
  memberName: string | null
  memberCode: string | null
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
  const [incomingMessages, setIncomingMessages] = useState<IncomingMessage[]>([])
  const [loadingIncoming, setLoadingIncoming] = useState(false)

  useEffect(() => {
    loadMembers()
    loadIncomingMessages()
  }, [])

  const loadIncomingMessages = async () => {
    setLoadingIncoming(true)
    try {
      const res = await fetch('/api/messaging/incoming?limit=50')
      if (res.ok) {
        const data = await res.json()
        setIncomingMessages(data.messages || [])
      }
    } catch (err) {
      console.error('Failed to load incoming messages:', err)
    } finally {
      setLoadingIncoming(false)
    }
  }

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
      showToast('Please select at least one member', 'error')
      return
    }

    if (!message.trim()) {
      showToast('Please enter a message', 'error')
      return
    }

    setSending(true)
    setSendStatus('Sending messages...')

    try {
      const memberIds = Array.from(selectedMembers)
      
      // Queue all messages in the backend (with 5-second delays)
      const res = await fetch('/api/messaging/send-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberIds: memberIds,
          message: message.trim(),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        
        // Clear everything immediately
        setMessage('')
        setSelectedMembers(new Set())
        setSearchQuery('')
        
        // Show success toast
        showToast(
          `${data.queued} messages are being sent! You can close this page.`,
          'success'
        )
      } else {
        const error = await res.json()
        showToast(`Failed to send messages: ${error.error || 'Unknown error'}`, 'error')
      }
    } catch (err) {
      console.error('Send error:', err)
      showToast('Failed to send messages', 'error')
    } finally {
      setSending(false)
      setSendStatus('')
    }
  }

  const filteredMembers = members.filter(m => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      (m.name && m.name.toLowerCase().includes(query)) ||
      (m.email && m.email.toLowerCase().includes(query)) ||
      (m.phone && m.phone.includes(searchQuery))
    )
  })

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleString('en-AU', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return timestamp
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Messages</h1>
        <p className="text-muted-foreground mt-1">
          Send and view WhatsApp messages
        </p>
      </div>

      <Tabs defaultValue="send" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="send">Send Messages</TabsTrigger>
          <TabsTrigger value="incoming">Incoming Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="send">
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
              Write your message (sent individually to each member via WhatsApp template)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Template preview header */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-lg">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                  📝 Message Template Format
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Each message is automatically prefilled with:
                </p>
                <div className="bg-white dark:bg-gray-800 mt-2 p-2 rounded text-xs font-mono border">
                  <p className="text-green-600 dark:text-green-400">Salam [Member Name],</p>
                  <p className="text-muted-foreground my-1">[Your message here]</p>
                  <p className="text-green-600 dark:text-green-400">Thank you - Mesaq</p>
                </div>
              </div>
              
              <Textarea
                placeholder="Type your message content here...

This will appear between 'Salam [Name],' and 'Thank you - Mesaq'

Example: We are pleased to inform you about our upcoming community event..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={10}
                className="resize-none"
              />

              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">Preview for selected member:</p>
                <div className="bg-muted p-3 rounded text-xs space-y-1">
                  <p><strong>Salam {selectedMembers.size > 0 ? '[Member Name]' : 'Ahmad'},</strong></p>
                  <p className="whitespace-pre-wrap">{message || 'Your message content will appear here...'}</p>
                  <p className="mt-2"><strong>Thank you - Mesaq</strong></p>
                </div>
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
        </TabsContent>

        <TabsContent value="incoming">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <IconMessage className="size-5" />
                    Incoming Messages
                  </CardTitle>
                  <CardDescription>
                    Recent messages received from members (read-only)
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={loadIncomingMessages}
                  disabled={loadingIncoming}
                >
                  <IconRefresh className={`size-4 mr-2 ${loadingIncoming ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingIncoming ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading messages...
                </div>
              ) : incomingMessages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <IconMessage className="size-12 mx-auto mb-3 opacity-30" />
                  <p>No incoming messages yet</p>
                  <p className="text-sm mt-1">Messages from members will appear here once Picky Assist webhook is configured</p>
                  <p className="text-xs mt-3 font-mono bg-muted p-2 rounded">
                    Webhook URL: /api/messaging/webhook
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {incomingMessages.map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`p-4 border rounded-lg ${msg.read ? 'bg-muted/30' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {!msg.read && (
                              <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                            )}
                            <span className="font-medium text-sm">
                              {msg.contactName || msg.phone}
                            </span>
                            {msg.contactName && (
                              <span className="text-xs text-muted-foreground font-mono">
                                {msg.phone}
                              </span>
                            )}
                            {msg.memberName && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                👤 {msg.memberName}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">
                              {formatTimestamp(msg.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {msg.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

