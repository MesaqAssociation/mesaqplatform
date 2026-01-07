"use client"

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { IconSend, IconUsers, IconSearch, IconMessage, IconRefresh, IconArrowLeft, IconChevronUp } from '@tabler/icons-react'
import { showToast } from '@/lib/toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

type Member = {
  id: string
  name: string
  phone: string | null
  email: string
  member_id: string
}

type Conversation = {
  phoneKey: string
  displayPhone: string
  contactName: string | null
  memberId: string | null
  memberName: string | null
  memberCode: string | null
  lastMessage: string
  lastTimestamp: string
  lastDirection: 'incoming' | 'outgoing'
  lastStatus: string | null
  unreadCount: number
  totalMessages: number
}

type Message = {
  id: string
  message: string
  messageType: string | null
  mediaUrl: string | null
  mediaType: string | null
  timestamp: string
  direction: 'incoming' | 'outgoing'
  status: string | null
  errorMessage: string | null
}

type Contact = {
  member_id: string | null
  member_name: string | null
  member_code: string | null
  phone: string | null
  email: string | null
}

export default function MessagingClient() {
  // Send Messages state
  const [members, setMembers] = useState<Member[]>([])
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Conversations state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [conversationMessages, setConversationMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [contact, setContact] = useState<Contact | null>(null)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [oldestTimestamp, setOldestTimestamp] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [conversationSearch, setConversationSearch] = useState('')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadMembers()
    loadConversations()
  }, [])

  useEffect(() => {
    // Scroll to bottom when messages change (but not when loading more)
    if (!loadingMore && conversationMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [conversationMessages, loadingMore])

  const loadConversations = async () => {
    setLoadingConversations(true)
    try {
      const res = await fetch('/api/messaging/conversations')
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || [])
      }
    } catch (err) {
      console.error('Failed to load conversations:', err)
    } finally {
      setLoadingConversations(false)
    }
  }

  const loadConversationMessages = async (phoneKey: string, loadMore = false) => {
    if (loadMore) {
      setLoadingMore(true)
    } else {
      setLoadingMessages(true)
      setConversationMessages([])
    }

    try {
      let url = `/api/messaging/conversations/${phoneKey}?limit=50`
      if (loadMore && oldestTimestamp) {
        url += `&before=${encodeURIComponent(oldestTimestamp)}`
      }

      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        if (loadMore) {
          setConversationMessages(prev => [...data.messages, ...prev])
        } else {
          setConversationMessages(data.messages || [])
          setContact(data.contact)
        }
        setHasMoreMessages(data.hasMore)
        setOldestTimestamp(data.oldestTimestamp)
        
        // Update unread count in conversations list
        setConversations(prev => prev.map(c => 
          c.phoneKey === phoneKey ? { ...c, unreadCount: 0 } : c
        ))
      }
    } catch (err) {
      console.error('Failed to load messages:', err)
    } finally {
      setLoadingMessages(false)
      setLoadingMore(false)
    }
  }

  const selectConversation = (phoneKey: string) => {
    setSelectedConversation(phoneKey)
    loadConversationMessages(phoneKey)
  }

  const backToConversations = () => {
    setSelectedConversation(null)
    setConversationMessages([])
    setContact(null)
    loadConversations() // Refresh to get updated read status
  }

  const loadMembers = async () => {
    try {
      const res = await fetch('/api/members')
      if (res.ok) {
        const data = await res.json()
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

    try {
      const memberIds = Array.from(selectedMembers)
      
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
        
        setMessage('')
        setSelectedMembers(new Set())
        setSearchQuery('')
        
        showToast(
          `✅ ${data.sent || data.queued} message${(data.sent || data.queued) === 1 ? '' : 's'} sent successfully!`,
          'success'
        )
        
        // Refresh conversations
        loadConversations()
      } else {
        const errorData = await res.json()
        showToast(errorData.error || 'Failed to send messages', 'error')
      }
    } catch (err) {
      console.error('Send error:', err)
      showToast('Failed to send messages', 'error')
    } finally {
      setSending(false)
    }
  }

  const filteredMembers = members.filter(m => {
    const query = searchQuery.toLowerCase()
    return (
      m.name.toLowerCase().includes(query) ||
      (m.email && m.email.toLowerCase().includes(query)) ||
      (m.phone && m.phone.includes(searchQuery))
    )
  })

  const filteredConversations = conversations.filter(c => {
    const query = conversationSearch.toLowerCase()
    return (
      (c.contactName && c.contactName.toLowerCase().includes(query)) ||
      (c.memberName && c.memberName.toLowerCase().includes(query)) ||
      c.displayPhone.includes(conversationSearch) ||
      (c.lastMessage && c.lastMessage.toLowerCase().includes(query))
    )
  })

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      const now = new Date()
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
      
      if (diffDays === 0) {
        return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
      } else if (diffDays === 1) {
        return 'Yesterday'
      } else if (diffDays < 7) {
        return date.toLocaleDateString('en-AU', { weekday: 'short' })
      } else {
        return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
      }
    } catch {
      return timestamp
    }
  }

  const formatMessageTime = (timestamp: string) => {
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

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'delivered': return '✓✓'
      case 'read': return '✓✓'
      case 'sent': return '✓'
      case 'failed': return '✗'
      default: return '○'
    }
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'read': return 'text-blue-500'
      case 'delivered': return 'text-muted-foreground'
      case 'sent': return 'text-muted-foreground'
      case 'failed': return 'text-red-500'
      default: return 'text-muted-foreground'
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

      <Tabs defaultValue="conversations" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="conversations">
            Conversations
            {conversations.reduce((sum, c) => sum + c.unreadCount, 0) > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {conversations.reduce((sum, c) => sum + c.unreadCount, 0)}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="send">Send New</TabsTrigger>
        </TabsList>

        {/* Conversations Tab */}
        <TabsContent value="conversations">
          <Card className="h-[calc(100vh-280px)] min-h-[500px]">
            {!selectedConversation ? (
              // Conversation List View
              <>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <IconMessage className="size-5" />
                        Conversations
                      </CardTitle>
                      <CardDescription>
                        {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
                      </CardDescription>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={loadConversations}
                      disabled={loadingConversations}
                    >
                      <IconRefresh className={`size-4 mr-2 ${loadingConversations ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                  <div className="relative mt-3">
                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search conversations..."
                      value={conversationSearch}
                      onChange={(e) => setConversationSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingConversations ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : filteredConversations.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <IconMessage className="size-12 mx-auto mb-3 opacity-30" />
                      <p>No conversations yet</p>
                      <p className="text-sm mt-1">Send a message to start a conversation</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[calc(100vh-420px)] min-h-[350px]">
                      <div className="divide-y">
                        {filteredConversations.map((conv) => (
                          <div
                            key={conv.phoneKey}
                            onClick={() => selectConversation(conv.phoneKey)}
                            className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                              conv.unreadCount > 0 ? 'bg-primary/5' : ''
                            }`}
                          >
                            {/* Avatar */}
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-lg font-semibold text-primary">
                                {(conv.contactName || conv.memberName || conv.displayPhone)?.[0]?.toUpperCase() || '?'}
                              </span>
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`font-medium truncate ${conv.unreadCount > 0 ? 'text-foreground' : 'text-foreground/80'}`}>
                                    {conv.contactName || conv.memberName || conv.displayPhone}
                                  </span>
                                  {conv.memberCode && (
                                    <Badge variant="outline" className="text-xs flex-shrink-0">
                                      {conv.memberCode}
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                                  {formatTimestamp(conv.lastTimestamp)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                                  {conv.lastDirection === 'outgoing' && (
                                    <span className={`mr-1 ${getStatusColor(conv.lastStatus)}`}>
                                      {getStatusIcon(conv.lastStatus)}
                                    </span>
                                  )}
                                  {conv.lastMessage || '(No message)'}
                                </p>
                                {conv.unreadCount > 0 && (
                                  <Badge variant="destructive" className="ml-2 h-5 min-w-5 flex items-center justify-center text-xs">
                                    {conv.unreadCount}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </>
            ) : (
              // Conversation Detail View
              <>
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={backToConversations}
                    >
                      <IconArrowLeft className="size-5" />
                    </Button>
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary">
                        {(contact?.member_name || selectedConversation)?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {contact?.member_name || selectedConversation}
                        </span>
                        {contact?.member_code && (
                          <Badge variant="outline" className="text-xs">
                            {contact.member_code}
                          </Badge>
                        )}
                      </div>
                      {contact?.phone && (
                        <p className="text-xs text-muted-foreground">{contact.phone}</p>
                      )}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => loadConversationMessages(selectedConversation)}
                      disabled={loadingMessages}
                    >
                      <IconRefresh className={`size-4 ${loadingMessages ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex flex-col h-[calc(100%-80px)]">
                  {loadingMessages ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : (
                    <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                      {/* Load More Button */}
                      {hasMoreMessages && (
                        <div className="flex justify-center mb-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => loadConversationMessages(selectedConversation, true)}
                            disabled={loadingMore}
                          >
                            {loadingMore ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                            ) : (
                              <IconChevronUp className="size-4 mr-2" />
                            )}
                            Load older messages
                          </Button>
                        </div>
                      )}
                      
                      {/* Messages */}
                      <div className="space-y-3">
                        {conversationMessages.map((msg, idx) => {
                          const isOutgoing = msg.direction === 'outgoing'
                          const showDate = idx === 0 || 
                            new Date(msg.timestamp).toDateString() !== 
                            new Date(conversationMessages[idx - 1].timestamp).toDateString()
                          
                          return (
                            <div key={msg.id}>
                              {/* Date separator */}
                              {showDate && (
                                <div className="flex justify-center my-4">
                                  <span className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground">
                                    {new Date(msg.timestamp).toLocaleDateString('en-AU', {
                                      weekday: 'long',
                                      day: 'numeric',
                                      month: 'long',
                                      year: 'numeric'
                                    })}
                                  </span>
                                </div>
                              )}
                              
                              {/* Message bubble */}
                              <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                                <div 
                                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                                    isOutgoing 
                                      ? 'bg-primary text-primary-foreground rounded-br-md' 
                                      : 'bg-muted rounded-bl-md'
                                  }`}
                                >
                                  {/* Message type badge for outgoing */}
                                  {isOutgoing && msg.messageType && (
                                    <div className="text-xs opacity-70 mb-1">
                                      {msg.messageType === 'payment_reminder' && '💰 Payment Reminder'}
                                      {msg.messageType === 'event_notification' && '📅 Event'}
                                      {msg.messageType === 'scheduled' && '📆 Scheduled'}
                                      {msg.messageType === 'admin_message' && '✉️ Message'}
                                    </div>
                                  )}
                                  
                                  {/* Message content */}
                                  <p className="whitespace-pre-wrap break-words text-sm">
                                    {msg.message}
                                  </p>
                                  
                                  {/* Media */}
                                  {msg.mediaUrl && (
                                    <div className="mt-2">
                                      {msg.mediaType === 'image' ? (
                                        <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer">
                                          <img 
                                            src={msg.mediaUrl} 
                                            alt="Attached" 
                                            className="max-w-[200px] rounded-lg cursor-pointer hover:opacity-90"
                                          />
                                        </a>
                                      ) : (
                                        <a 
                                          href={msg.mediaUrl} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className={`inline-flex items-center gap-2 px-3 py-1 rounded text-sm ${
                                            isOutgoing ? 'bg-primary-foreground/20' : 'bg-background'
                                          }`}
                                        >
                                          📎 Download File
                                        </a>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Error message */}
                                  {msg.errorMessage && (
                                    <p className="text-xs mt-1 text-red-300">
                                      Error: {msg.errorMessage}
                                    </p>
                                  )}
                                  
                                  {/* Timestamp and status */}
                                  <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${
                                    isOutgoing ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                  }`}>
                                    <span>{formatMessageTime(msg.timestamp)}</span>
                                    {isOutgoing && (
                                      <span className={msg.status === 'read' ? 'text-blue-300' : ''}>
                                        {getStatusIcon(msg.status)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </>
            )}
          </Card>
        </TabsContent>

        {/* Send New Tab */}
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
                  Write your message (sent individually to each member via WhatsApp)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Pre-written greeting */}
                  <div className="border-l-4 border-primary pl-4 py-2 bg-muted/50 rounded-r">
                    <p className="font-semibold text-primary">Salam (Member Name),</p>
                  </div>
                  
                  {/* Message input */}
                  <Textarea
                    placeholder="Type your message content here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={8}
                    className="resize-none border-2 focus:border-primary"
                  />

                  {/* Pre-written sign-off */}
                  <div className="border-l-4 border-primary pl-4 py-2 bg-muted/50 rounded-r">
                    <p className="font-semibold text-primary">Thank you - Mesaq Association</p>
                  </div>

                  {sending && (
                    <div className="flex items-center justify-center gap-3 py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      <p className="text-sm text-muted-foreground">Sending messages...</p>
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
      </Tabs>
    </div>
  )
}
