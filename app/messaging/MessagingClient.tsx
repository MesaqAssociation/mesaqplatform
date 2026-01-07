"use client"

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IconSend, IconSearch, IconChevronUp, IconTemplate, IconMessage } from '@tabler/icons-react'
import { showToast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

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

type Member = {
  id: string
  name: string
  phone: string | null
  member_id: string
}

export default function MessagingClient() {
  // Conversations state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [conversationMessages, setConversationMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [contact, setContact] = useState<Contact | null>(null)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [oldestTimestamp, setOldestTimestamp] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Message input state
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [canSendFreeText, setCanSendFreeText] = useState(false)
  
  // Members for search
  const [allMembers, setAllMembers] = useState<Member[]>([])
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadConversations()
    loadMembers()
  }, [])

  useEffect(() => {
    if (!loadingMore && conversationMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [conversationMessages, loadingMore])

  // Check if can send free text (last incoming message within 24 hours)
  useEffect(() => {
    if (conversationMessages.length > 0) {
      const lastIncoming = [...conversationMessages]
        .reverse()
        .find(m => m.direction === 'incoming')
      
      if (lastIncoming) {
        const lastIncomingTime = new Date(lastIncoming.timestamp).getTime()
        const now = Date.now()
        const hoursDiff = (now - lastIncomingTime) / (1000 * 60 * 60)
        setCanSendFreeText(hoursDiff <= 24)
      } else {
        setCanSendFreeText(false)
      }
    } else {
      setCanSendFreeText(false)
    }
  }, [conversationMessages])

  const loadMembers = async () => {
    try {
      const res = await fetch('/api/members')
      if (res.ok) {
        const data = await res.json()
        setAllMembers(data.members.filter((m: Member) => m.phone))
      }
    } catch (err) {
      console.error('Failed to load members:', err)
    }
  }

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
    setNewMessage('')
    loadConversationMessages(phoneKey)
  }

  const startNewConversation = (member: Member) => {
    // Check if conversation already exists
    const phoneKey = member.phone?.replace(/\D/g, '').slice(-9) || ''
    const existing = conversations.find(c => c.phoneKey === phoneKey)
    
    if (existing) {
      selectConversation(existing.phoneKey)
    } else {
      // Create a temporary conversation entry
      const newConv: Conversation = {
        phoneKey,
        displayPhone: member.phone || '',
        contactName: member.name,
        memberId: member.id,
        memberName: member.name,
        memberCode: member.member_id,
        lastMessage: '',
        lastTimestamp: new Date().toISOString(),
        lastDirection: 'outgoing',
        lastStatus: null,
        unreadCount: 0,
        totalMessages: 0
      }
      setConversations(prev => [newConv, ...prev])
      setSelectedConversation(phoneKey)
      setConversationMessages([])
      setContact({
        member_id: member.id,
        member_name: member.name,
        member_code: member.member_id,
        phone: member.phone,
        email: null
      })
      setCanSendFreeText(false)
    }
    setSearchQuery('')
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !contact?.member_id) return
    
    setSending(true)
    try {
      const res = await fetch('/api/messaging/send-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: contact.member_id,
          message: newMessage.trim(),
        }),
      })

      if (res.ok) {
        // Add optimistic message
        const optimisticMessage: Message = {
          id: `temp-${Date.now()}`,
          message: canSendFreeText ? newMessage.trim() : newMessage.trim(),
          messageType: 'admin_message',
          mediaUrl: null,
          mediaType: null,
          timestamp: new Date().toISOString(),
          direction: 'outgoing',
          status: 'sent',
          errorMessage: null
        }
        setConversationMessages(prev => [...prev, optimisticMessage])
        setNewMessage('')
        showToast('Message sent!', 'success')
        
        // Refresh conversations list
        loadConversations()
      } else {
        const errorData = await res.json()
        showToast(errorData.error || 'Failed to send message', 'error')
      }
    } catch (err) {
      console.error('Send error:', err)
      showToast('Failed to send message', 'error')
    } finally {
      setSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Filter conversations and members based on search
  const filteredConversations = conversations.filter(c => {
    const query = searchQuery.toLowerCase()
    return (
      (c.contactName && c.contactName.toLowerCase().includes(query)) ||
      (c.memberName && c.memberName.toLowerCase().includes(query)) ||
      c.displayPhone.includes(searchQuery)
    )
  })

  const searchResults = searchQuery.length >= 2 
    ? allMembers.filter(m => 
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !conversations.some(c => c.phoneKey === m.phone?.replace(/\D/g, '').slice(-9))
      ).slice(0, 5)
    : []

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
      return ''
    }
  }

  const formatMessageTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString('en-AU', { 
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return ''
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

  const selectedConv = conversations.find(c => c.phoneKey === selectedConversation)

  return (
    <div className="h-[calc(100vh-140px)] flex bg-background rounded-lg border overflow-hidden">
      {/* Left Sidebar - Conversations List */}
      <div className="w-80 border-r flex flex-col bg-card">
        {/* Header */}
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold mb-3">Messages</h2>
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
              placeholder="Search or start new chat..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              </div>

        {/* Search Results - New Conversations */}
        {searchResults.length > 0 && (
          <div className="border-b">
            <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase">
              Start New Chat
            </div>
            {searchResults.map(member => (
                    <div
                      key={member.id}
                onClick={() => startNewConversation(member)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary">
                    {member.name[0]?.toUpperCase()}
                  </span>
                </div>
                      <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{member.name}</div>
                  <div className="text-xs text-muted-foreground">{member.phone}</div>
                </div>
                <Badge variant="outline" className="text-xs">New</Badge>
              </div>
            ))}
          </div>
        )}

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          {loadingConversations ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground px-4">
              <IconMessage className="size-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Search for a member to start chatting</p>
                        </div>
          ) : (
            <div>
              {filteredConversations.map((conv) => (
                <div
                  key={conv.phoneKey}
                  onClick={() => selectConversation(conv.phoneKey)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    selectedConversation === conv.phoneKey 
                      ? 'bg-primary/10' 
                      : conv.unreadCount > 0 
                        ? 'bg-primary/5 hover:bg-primary/10' 
                        : 'hover:bg-muted/50'
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-semibold text-primary">
                      {(conv.contactName || conv.memberName || '?')[0]?.toUpperCase()}
                    </span>
                      </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`font-medium truncate ${conv.unreadCount > 0 ? 'text-foreground' : 'text-foreground/80'}`}>
                        {conv.contactName || conv.memberName || conv.displayPhone}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {formatTimestamp(conv.lastTimestamp)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        {conv.lastDirection === 'outgoing' && (
                          <span className={`mr-1 ${conv.lastStatus === 'read' ? 'text-blue-500' : 'text-muted-foreground'}`}>
                            {getStatusIcon(conv.lastStatus)}
                          </span>
                        )}
                        {conv.lastMessage || 'Start a conversation'}
                      </p>
                      {conv.unreadCount > 0 && (
                        <Badge variant="default" className="ml-2 h-5 min-w-5 flex items-center justify-center text-xs bg-primary">
                          {conv.unreadCount}
                        </Badge>
                )}
              </div>
            </div>
                </div>
              ))}
                </div>
              )}
        </ScrollArea>
      </div>

      {/* Right Panel - Chat View */}
      <div className="flex-1 flex flex-col bg-muted/30">
        {!selectedConversation ? (
          // No conversation selected
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <IconMessage className="size-16 mx-auto mb-4 opacity-20" />
              <h3 className="text-xl font-medium mb-2">Select a conversation</h3>
              <p className="text-sm">Choose from your existing conversations or search for a member to start a new chat</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="px-6 py-4 border-b bg-card flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary">
                  {(contact?.member_name || selectedConv?.contactName || '?')[0]?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">
                    {contact?.member_name || selectedConv?.contactName || selectedConversation}
                  </h3>
                  {contact?.member_code && (
                    <Badge variant="outline" className="text-xs">{contact.member_code}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{contact?.phone || selectedConv?.displayPhone}</p>
              </div>
                </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-1 max-w-3xl mx-auto">
                  {/* Load More Button */}
                  {hasMoreMessages && (
                    <div className="flex justify-center mb-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loadConversationMessages(selectedConversation, true)}
                        disabled={loadingMore}
                        className="text-xs"
                      >
                        {loadingMore ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                        ) : (
                          <IconChevronUp className="size-4 mr-1" />
                        )}
                        Load older messages
                      </Button>
                    </div>
                  )}
                  
                  {/* Messages */}
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
                                month: 'long'
                              })}
                            </span>
                          </div>
                        )}
                        
                        {/* Message bubble */}
                        <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} mb-1`}>
                          <div 
                            className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                              isOutgoing 
                                ? 'bg-primary text-primary-foreground rounded-br-sm' 
                                : 'bg-card border rounded-bl-sm'
                            }`}
                          >
                            {/* Message type badge */}
                            {isOutgoing && msg.messageType && msg.messageType !== 'admin_message' && (
                              <div className={`text-xs mb-1 ${isOutgoing ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                {msg.messageType === 'payment_reminder' && '💰 Payment Reminder'}
                                {msg.messageType === 'event_notification' && '📅 Event'}
                                {msg.messageType === 'scheduled' && '📆 Scheduled'}
                              </div>
                            )}
                            
                            {/* Message content */}
                            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
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
                                      isOutgoing ? 'bg-primary-foreground/20' : 'bg-muted'
                                    }`}
                                  >
                                    📎 Download File
                                  </a>
                                )}
                              </div>
                            )}
                            
                            {/* Error */}
                            {msg.errorMessage && (
                              <p className="text-xs mt-1 text-red-300">⚠ {msg.errorMessage}</p>
                            )}
                            
                            {/* Time and status */}
                            <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                              isOutgoing ? 'text-primary-foreground/60' : 'text-muted-foreground'
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
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t bg-card">
              <div className="max-w-3xl mx-auto">
                {/* Template indicator */}
                {!canSendFreeText && (
                  <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                    <IconTemplate className="size-3" />
                    <span>Using template: <span className="font-medium">Salam [Name], ... Thank you - Mesaq</span></span>
                    <span className="text-amber-500">(No reply within 24h)</span>
                  </div>
                )}
                {canSendFreeText && (
                  <div className="flex items-center gap-2 mb-2 text-xs text-green-600">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <span>24h window active - Free text messaging enabled</span>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Input
                    placeholder={canSendFreeText ? "Type a message..." : "Type your message (will be sent with template)..."}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={sending || !contact?.member_id}
                    className="flex-1"
                  />
                  <Button 
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending || !contact?.member_id}
                    size="icon"
                  >
                    {sending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
                    ) : (
                      <IconSend className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
