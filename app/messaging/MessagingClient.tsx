"use client"

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { IconSend, IconSearch, IconChevronUp, IconMessage, IconRefresh, IconUsers, IconWallet, IconExternalLink, IconDownload, IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import { showToast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils'

type Conversation = {
  phoneKey: string
  displayPhone: string
  contactName: string | null
  memberId: string | null
  memberName: string | null
  memberCode: string | null
  memberImage: string | null
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
  image: string | null
}

type Member = {
  id: string
  name: string
  phone: string | null
  email: string
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
  
  // Members for search and bulk messaging
  const [allMembers, setAllMembers] = useState<Member[]>([])
  
  // Bulk messaging state
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [bulkMessage, setBulkMessage] = useState('')
  const [bulkSearchQuery, setBulkSearchQuery] = useState('')
  const [sendingBulk, setSendingBulk] = useState(false)
  const [loadingMembers, setLoadingMembers] = useState(true)
  
  // Balance state
  const [balance, setBalance] = useState<number | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [showTopupGuide, setShowTopupGuide] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  
  // Mobile state
  const [showConversationList, setShowConversationList] = useState(true)
  
  // Refresh state (for button animation)
  const [refreshing, setRefreshing] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Detect mobile on mount
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    loadConversations(true) // Initial load shows loading state
    loadMembers()
    loadBalance()
  }, [])

  // Scroll to bottom helper
  const scrollToBottom = (instant = false) => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'instant' : 'smooth' })
    }, 50)
  }

  // Scroll to bottom when messages change (but not when loading older messages)
  useEffect(() => {
    if (!loadingMore && conversationMessages.length > 0) {
      scrollToBottom()
    }
  }, [conversationMessages, loadingMore])

  // SMS doesn't have the 24h window limitation like WhatsApp
  // Always allow sending messages
  useEffect(() => {
    setCanSendFreeText(true)
  }, [conversationMessages])

  const loadBalance = async () => {
    setLoadingBalance(true)
    try {
      const res = await fetch('/api/messaging/balance')
      if (res.ok) {
        const data = await res.json()
        setBalance(data.balance)
      }
    } catch (err) {
      console.error('Failed to load balance:', err)
    } finally {
      setLoadingBalance(false)
    }
  }

  const loadMembers = async () => {
    setLoadingMembers(true)
    try {
      const res = await fetch('/api/members')
      if (res.ok) {
        const data = await res.json()
        setAllMembers(data.members.filter((m: Member) => m.phone))
      }
    } catch (err) {
      console.error('Failed to load members:', err)
    } finally {
      setLoadingMembers(false)
    }
  }

  // Load conversations - silent refresh by default (no loading spinner)
  const loadConversations = async (showLoading = false) => {
    if (showLoading) setLoadingConversations(true)
    try {
      const res = await fetch('/api/messaging/conversations')
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || [])
      }
    } catch (err) {
      console.error('Failed to load conversations:', err)
    } finally {
      if (showLoading) setLoadingConversations(false)
    }
  }

  // Load messages for a conversation - silent refresh by default
  const loadConversationMessages = async (phoneKey: string, loadMore = false, silent = false) => {
    if (loadMore) {
      setLoadingMore(true)
    } else if (!silent) {
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
          // For silent refresh, only update if there are changes
          if (silent) {
            const newMessages = data.messages || []
            // Check if messages changed
            const oldIds = conversationMessages.map(m => m.id).join(',')
            const newIds = newMessages.map((m: Message) => m.id).join(',')
            if (newIds !== oldIds) {
              setConversationMessages(newMessages)
              scrollToBottom() // Scroll to bottom on update
            }
          } else {
            setConversationMessages(data.messages || [])
            scrollToBottom(true) // Instant scroll when opening chat
          }
          setContact(data.contact)
        }
        setHasMoreMessages(data.hasMore)
        setOldestTimestamp(data.oldestTimestamp)
        
        // Update unread count
        setConversations(prev => prev.map(c => 
          c.phoneKey === phoneKey ? { ...c, unreadCount: 0 } : c
        ))
      }
    } catch (err) {
      console.error('Failed to load messages:', err)
    } finally {
      if (!silent) setLoadingMessages(false)
      setLoadingMore(false)
    }
  }

  // Refresh all - updates both list and current chat silently (button still spins)
  const refreshAll = async () => {
    setRefreshing(true)
    try {
      await loadConversations(false) // Silent refresh (no content loading state)
      if (selectedConversation) {
        await loadConversationMessages(selectedConversation, false, true) // Silent refresh
      }
    } finally {
      setRefreshing(false)
    }
  }

  const selectConversation = (phoneKey: string) => {
    setSelectedConversation(phoneKey)
    setNewMessage('')
    setShowConversationList(false) // Hide list on mobile
    loadConversationMessages(phoneKey)
  }

  const backToList = () => {
    setShowConversationList(true)
    setSelectedConversation(null)
  }

  const startNewConversation = (member: Member) => {
    const phoneKey = member.phone?.replace(/\D/g, '').slice(-9) || ''
    const existing = conversations.find(c => c.phoneKey === phoneKey)
    
    if (existing) {
      selectConversation(existing.phoneKey)
    } else {
      const newConv: Conversation = {
        phoneKey,
        displayPhone: member.phone || '',
        contactName: member.name,
        memberId: member.id,
        memberName: member.name,
        memberCode: member.member_id,
        memberImage: null,
        lastMessage: '',
        lastTimestamp: new Date().toISOString(),
        lastDirection: 'outgoing',
        lastStatus: null,
        unreadCount: 0,
        totalMessages: 0
      }
      setConversations(prev => [newConv, ...prev])
      setSelectedConversation(phoneKey)
      setShowConversationList(false)
      setConversationMessages([])
      setContact({
        member_id: member.id,
        member_name: member.name,
        member_code: member.member_id,
        phone: member.phone,
        email: null,
        image: null
      })
      setCanSendFreeText(false)
    }
    setSearchQuery('')
  }

  // Get effective member ID and phone from contact or conversation
  // PRIORITY: Member name (if matched) > Contact name from message
  const selectedConv = conversations.find(c => c.phoneKey === selectedConversation)
  const effectiveMemberId = contact?.member_id || selectedConv?.memberId
  const effectivePhone = contact?.phone || selectedConv?.displayPhone
  // Use memberName first if available (means it's a matched member)
  const effectiveName = contact?.member_name || selectedConv?.memberName || selectedConv?.contactName
  const effectiveImage = contact?.image || selectedConv?.memberImage
  const effectiveMemberCode = contact?.member_code || selectedConv?.memberCode

  const sendMessage = async () => {
    if (!newMessage.trim()) return
    if (!effectiveMemberId && !effectivePhone) return
    
    setSending(true)
    try {
      const res = await fetch('/api/messaging/send-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: effectiveMemberId || undefined,
          phoneNumber: !effectiveMemberId ? effectivePhone : undefined,
          contactName: !effectiveMemberId ? effectiveName : undefined,
          message: newMessage.trim(),
        }),
      })

      if (res.ok) {
        // Just show the message as sent (no template wrapper for SMS)
        const displayMessage = newMessage.trim()
        
        const optimisticMessage: Message = {
          id: `temp-${Date.now()}`,
          message: displayMessage,
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
        loadConversations() // Silent refresh
        loadBalance() // Refresh balance after sending
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

  // Bulk messaging functions
  const toggleMember = (memberId: string) => {
    const newSelected = new Set(selectedMembers)
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId)
    } else {
      newSelected.add(memberId)
    }
    setSelectedMembers(newSelected)
  }

  const filteredMembersForBulk = allMembers.filter(m => {
    const query = bulkSearchQuery.toLowerCase()
    return (
      m.name.toLowerCase().includes(query) ||
      (m.email && m.email.toLowerCase().includes(query)) ||
      (m.phone && m.phone.includes(bulkSearchQuery))
    )
  })

  const toggleAll = () => {
    if (selectedMembers.size === filteredMembersForBulk.length) {
      setSelectedMembers(new Set())
    } else {
      setSelectedMembers(new Set(filteredMembersForBulk.map(m => m.id)))
    }
  }

  const handleBulkSend = async () => {
    if (selectedMembers.size === 0) {
      showToast('Please select at least one member', 'error')
      return
    }
    if (!bulkMessage.trim()) {
      showToast('Please enter a message', 'error')
      return
    }

    // Balance check is handled by the API

    setSendingBulk(true)
    try {
      const res = await fetch('/api/messaging/send-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberIds: Array.from(selectedMembers),
          message: bulkMessage.trim(),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setBulkMessage('')
        setSelectedMembers(new Set())
        setBulkSearchQuery('')
        showToast(`✅ ${data.sent || data.queued} message(s) sent successfully!`, 'success')
        loadConversations()
        loadBalance() // Refresh balance after sending
      } else {
        const errorData = await res.json()
        showToast(errorData.error || 'Failed to send messages', 'error')
      }
    } catch (err) {
      console.error('Bulk send error:', err)
      showToast('Failed to send messages', 'error')
    } finally {
      setSendingBulk(false)
    }
  }

  // Filter conversations and members based on search
  const filteredConversations = conversations.filter(c => {
    const query = searchQuery.toLowerCase()
    // Search by member name first, then contact name, then phone
    const displayName = c.memberName || c.contactName || ''
    return (
      displayName.toLowerCase().includes(query) ||
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

  // Get display name for conversation - member name takes priority
  const getDisplayName = (conv: Conversation) => {
    return conv.memberName || conv.contactName || conv.displayPhone
  }

  const topupSteps = [
    { image: '', text: <>Go to <a href="https://mobilemessage.com.au" target="_blank" rel="noopener noreferrer" className="text-primary underline">mobilemessage.com.au</a> and login to your account</> },
    { image: '', text: <>Navigate to the <strong>Credits</strong> or <strong>Billing</strong> section</> },
    { image: '', text: <>Choose the amount of credits you want to purchase</> },
    { image: '', text: <>Complete the payment process</> },
    { image: '', text: <>Credits will be added to your account immediately</> },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Messages</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">Send and view WhatsApp messages</p>
      </div>

      <Tabs defaultValue="conversations" className="w-full">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="conversations" className="text-xs md:text-sm">
            Conversations
            {conversations.reduce((sum, c) => sum + c.unreadCount, 0) > 0 && (
              <Badge variant="destructive" className="ml-1 md:ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {conversations.reduce((sum, c) => sum + c.unreadCount, 0)}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="bulk" className="text-xs md:text-sm">Bulk Message</TabsTrigger>
          <TabsTrigger value="balance" className="text-xs md:text-sm">
            <IconWallet className="size-4 mr-1" />
            Balance
          </TabsTrigger>
        </TabsList>

        {/* Conversations Tab */}
        <TabsContent value="conversations" className="mt-0">
          <div className="h-[calc(100vh-220px)] min-h-[400px] flex bg-background rounded-lg border overflow-hidden">
            {/* Left Sidebar - Conversations List */}
            <div className={`${showConversationList ? 'flex' : 'hidden'} md:flex w-full md:w-80 border-r flex-col bg-card`}>
              {/* Header */}
              <div className="p-3 md:p-4 border-b">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search or start new chat..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 text-sm"
                    />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={refreshAll}
                    disabled={refreshing}
                    title="Refresh conversations"
                  >
                    <IconRefresh className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
                  </Button>
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
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-sm">{member.name}</div>
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
                    {filteredConversations.map((conv) => {
                      const displayName = getDisplayName(conv)
                      const isMember = !!conv.memberId
                      
                      return (
                        <div
                          key={conv.phoneKey}
                          onClick={() => selectConversation(conv.phoneKey)}
                          className={`flex items-center gap-3 px-3 md:px-4 py-3 cursor-pointer transition-colors ${
                            selectedConversation === conv.phoneKey 
                              ? 'bg-primary/10' 
                              : conv.unreadCount > 0 
                                ? 'bg-primary/5 hover:bg-primary/10' 
                                : 'hover:bg-muted/50'
                          }`}
                        >
                          <Avatar className="h-11 w-11 md:h-12 md:w-12 flex-shrink-0">
                            <AvatarImage src={conv.memberImage || undefined} alt={displayName} />
                            <AvatarFallback>
                              {getInitials(displayName)}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`font-medium truncate text-sm ${conv.unreadCount > 0 ? 'text-foreground' : 'text-foreground/80'}`}>
                                  {displayName}
                                </span>
                                {isMember && (
                                  <span className="text-[10px] bg-primary/10 text-primary px-1 rounded flex-shrink-0">
                                    Member
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                                {formatTimestamp(conv.lastTimestamp)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className={`text-xs md:text-sm truncate ${conv.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
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
                      )
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Right Panel - Chat View */}
            <div className={`${!showConversationList ? 'flex' : 'hidden'} md:flex flex-1 flex-col bg-muted/30`}>
              {!selectedConversation ? (
                <div className="flex-1 flex items-center justify-center p-4">
                  <div className="text-center text-muted-foreground">
                    <IconMessage className="size-12 md:size-16 mx-auto mb-4 opacity-20" />
                    <h3 className="text-lg md:text-xl font-medium mb-2">Select a conversation</h3>
                    <p className="text-xs md:text-sm">Choose from your existing conversations or search for a member</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Chat Header */}
                  <div className="px-3 md:px-6 py-3 md:py-4 border-b bg-card flex items-center gap-3 md:gap-4">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={backToList}
                      className="md:hidden"
                    >
                      <IconChevronRight className="size-5 rotate-180" />
                    </Button>
                    <Avatar className="h-9 w-9 md:h-10 md:w-10">
                      <AvatarImage src={effectiveImage || undefined} alt={effectiveName || 'Contact'} />
                      <AvatarFallback>
                        {getInitials(effectiveName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm md:text-base truncate">
                          {effectiveName || selectedConversation}
                        </h3>
                        {effectiveMemberCode && (
                          <Badge variant="outline" className="text-xs hidden sm:inline-flex">
                            {effectiveMemberCode}
                          </Badge>
                        )}
                        {effectiveMemberId && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1 rounded hidden sm:inline-block">
                            Member
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {effectivePhone}
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={refreshAll}
                      disabled={refreshing}
                      title="Refresh conversation"
                    >
                      <IconRefresh className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>

                  {/* Messages */}
                  <ScrollArea className="flex-1 p-3 md:p-4">
                    {loadingMessages ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : (
                      <div className="space-y-1 max-w-3xl mx-auto">
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
                        
                        {conversationMessages.map((msg, idx) => {
                          const isOutgoing = msg.direction === 'outgoing'
                          const showDate = idx === 0 || 
                            new Date(msg.timestamp).toDateString() !== 
                            new Date(conversationMessages[idx - 1].timestamp).toDateString()
                          
                          return (
                            <div key={msg.id}>
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
                              
                              <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} mb-1`}>
                                <div 
                                  className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-3 md:px-4 py-2 ${
                                    isOutgoing 
                                      ? 'bg-primary text-primary-foreground rounded-br-sm' 
                                      : 'bg-card border rounded-bl-sm'
                                  }`}
                                >
                                  {isOutgoing && msg.messageType && msg.messageType !== 'admin_message' && (
                                    <div className={`text-xs mb-1 ${isOutgoing ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                      {msg.messageType === 'payment_reminder' && '💰 Payment Reminder'}
                                      {msg.messageType === 'event_notification' && '📅 Event'}
                                      {msg.messageType === 'scheduled' && '📆 Scheduled'}
                                    </div>
                                  )}
                                  
                                  {msg.message && (
                                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                                      {msg.message}
                                    </p>
                                  )}
                                  
                                  {/* Media attachments */}
                                  {msg.mediaUrl && (
                                    <div className={msg.message ? 'mt-2' : ''}>
                                      {msg.mediaType === 'image' ? (
                                        <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer">
                                          <img 
                                            src={msg.mediaUrl} 
                                            alt="Image" 
                                            className="max-w-[200px] rounded-lg cursor-pointer hover:opacity-90"
                                          />
                                        </a>
                                      ) : (
                                        <a 
                                          href={msg.mediaUrl} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-2 px-3 py-2 bg-background border rounded-lg hover:bg-muted transition-colors text-sm text-foreground"
                                        >
                                          <IconDownload className="size-4" />
                                          Download File
                                        </a>
                                      )}
                                    </div>
                                  )}
                                  
                                  {msg.errorMessage && (
                                    <p className="text-xs mt-1 text-red-300">⚠ {msg.errorMessage}</p>
                                  )}
                                  
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
                  <div className="p-3 md:p-4 border-t bg-card">
                    <div className="max-w-3xl mx-auto">
                      
                      <div className="flex gap-2">
                        <Input
                          placeholder={canSendFreeText ? "Type a message..." : "Type your message..."}
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={handleKeyPress}
                          disabled={sending || (!effectiveMemberId && !effectivePhone)}
                          className="flex-1 text-sm"
                        />
                        <Button 
                          onClick={sendMessage}
                          disabled={!newMessage.trim() || sending || (!effectiveMemberId && !effectivePhone)}
                          size="icon"
                        >
                          {sending ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
                          ) : (
                            <IconSend className="size-4" />
                          )}
                        </Button>
                      </div>
                      {!effectiveMemberId && effectivePhone && (
                        <p className="text-xs text-muted-foreground mt-2">
                          ℹ Sending to {effectivePhone}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Bulk Message Tab */}
        <TabsContent value="bulk" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Member Selection */}
        <Card>
              <CardHeader className="p-4 md:p-6 pb-2">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <IconUsers className="size-5" />
              Select Recipients
            </CardTitle>
                <CardDescription className="text-xs md:text-sm">
              Choose members to send messages to ({selectedMembers.size} selected)
            </CardDescription>
          </CardHeader>
              <CardContent className="p-4 md:p-6 pt-2">
            <div className="space-y-3">
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search members..."
                      value={bulkSearchQuery}
                      onChange={(e) => setBulkSearchQuery(e.target.value)}
                      className="pl-9 text-sm"
                />
              </div>

              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox
                  id="select-all"
                      checked={selectedMembers.size === filteredMembersForBulk.length && filteredMembersForBulk.length > 0}
                  onCheckedChange={toggleAll}
                />
                <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                      Select All ({filteredMembersForBulk.length})
                </label>
              </div>

                  <div className="space-y-2 max-h-[300px] md:max-h-[400px] overflow-y-auto">
                    {loadingMembers ? (
                      <p className="text-center text-muted-foreground py-4 text-sm">Loading members...</p>
                    ) : filteredMembersForBulk.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4 text-sm">No members found</p>
                    ) : (
                      filteredMembersForBulk.map((member) => (
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
                            <div className="font-medium text-sm">{member.name}</div>
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
              <CardHeader className="p-4 md:p-6 pb-2">
                <CardTitle className="text-base md:text-lg">Compose Message</CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Write your message (sent individually to each member via SMS)
            </CardDescription>
          </CardHeader>
              <CardContent className="p-4 md:p-6 pt-2">
            <div className="space-y-3">
                  {/* Variable Dropdown */}
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-muted-foreground self-center">Insert variable:</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBulkMessage(prev => prev + '{{name}}')}
                      className="text-xs h-7"
                    >
                      Full Name
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBulkMessage(prev => prev + '{{phone}}')}
                      className="text-xs h-7"
                    >
                      Phone
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBulkMessage(prev => prev + '{{group}}')}
                      className="text-xs h-7"
                    >
                      Group
                    </Button>
                  </div>
                  
              <Textarea
                    placeholder="Type your message here... Use variables like {{name}}, {{phone}}, {{group}}"
                    value={bulkMessage}
                    onChange={(e) => setBulkMessage(e.target.value)}
                    rows={6}
                    className="resize-none border-2 focus:border-primary text-sm font-mono"
                  />

                  <p className="text-xs text-muted-foreground">
                    💡 Variables will be replaced with member data. If a member doesn't have a value set, "N/A" will be used.
                  </p>

                  {sendingBulk && (
                    <div className="flex items-center justify-center gap-3 py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      <p className="text-sm text-muted-foreground">Sending messages...</p>
                </div>
              )}

              <Button 
                    onClick={handleBulkSend} 
                    disabled={selectedMembers.size === 0 || !bulkMessage.trim() || sendingBulk}
                className="w-full"
                size="lg"
              >
                <IconSend className="mr-2 size-4" />
                    {sendingBulk ? 'Sending...' : `Send to ${selectedMembers.size} Member(s)`}
              </Button>
            </div>
          </CardContent>
        </Card>
          </div>
        </TabsContent>

        {/* Balance Tab */}
        <TabsContent value="balance" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Current Balance */}
          <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <IconWallet className="size-5" />
                  SMS Credits
                  </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  Your current SMS messaging credits (1 credit per message)
                  </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                <div className="space-y-4">
                  <div className="text-center p-6 bg-muted/50 rounded-lg">
                    {loadingBalance ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    ) : balance !== null ? (
                      <>
                        <p className="text-4xl md:text-5xl font-bold text-primary">
                          {Math.floor(balance)}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">Credits Available</p>
                        <p className="text-xs text-muted-foreground mt-1">({balance} messages)</p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">Unable to fetch balance</p>
                    )}
                </div>
                  
                  <div className="flex gap-2">
                <Button 
                  variant="outline" 
                      onClick={loadBalance}
                      disabled={loadingBalance}
                      className="flex-1"
                    >
                      <IconRefresh className={`size-4 mr-2 ${loadingBalance ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                    <Button asChild className="flex-1">
                      <a href="https://mobilemessage.com.au" target="_blank" rel="noopener noreferrer">
                        <IconExternalLink className="size-4 mr-2" />
                        Topup
                      </a>
                </Button>
              </div>
                </div>
              </CardContent>
            </Card>

            {/* How to Topup */}
            <Card>
              <CardHeader className="p-4 md:p-6">
                {/* On mobile: clickable dropdown header */}
                {isMobile ? (
                  <button 
                    onClick={() => setShowTopupGuide(!showTopupGuide)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <div>
                      <CardTitle className="text-base md:text-lg">How to Topup</CardTitle>
                      <CardDescription className="text-xs md:text-sm">
                        Step-by-step guide to add SMS credits
                      </CardDescription>
                </div>
                    {showTopupGuide ? (
                      <IconChevronDown className="size-5 text-muted-foreground" />
                    ) : (
                      <IconChevronRight className="size-5 text-muted-foreground" />
                    )}
                  </button>
                ) : (
                  // On desktop: always visible, no dropdown
                  <div>
                    <CardTitle className="text-base md:text-lg">How to Topup</CardTitle>
                    <CardDescription className="text-xs md:text-sm">
                      Step-by-step guide to add SMS credits
                    </CardDescription>
                  </div>
                )}
              </CardHeader>
              {/* Show content: always on desktop, conditionally on mobile */}
              {(!isMobile || showTopupGuide) && (
                <CardContent className="p-4 md:p-6 pt-0">
                  <div className="space-y-4">
                    {topupSteps.map((step, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex-shrink-0">
                          {index + 1}
                        </span>
                        <p className="text-sm">{step.text}</p>
                    </div>
                  ))}
                    <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        <strong>Note:</strong> Each SMS costs 1 credit. Contact Mobile Message support if you need help with your account.
                      </p>
                    </div>
                </div>
                </CardContent>
              )}
          </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
