"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { IconPlus, IconBell, IconTrash, IconSend, IconCheck, IconX, IconClock, IconCalendarEvent, IconMapPin, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { showToast } from '@/lib/toast'

type Notification = {
  id: string
  title: string
  message: string
  scheduled_date: string
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
  created_at: string
  sent_at: string | null
  recipients_count: number
  created_by_name: string | null
  recipient_type: 'everyone' | 'specific' | null
  recipient_ids: string[] | null
}

type Event = {
  id: string
  title: string
  description: string | null
  event_date: string
  start_time: string | null
  end_time: string | null
  address: string | null
  organizing_group: string | null
}

export default function CalendarClient({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [creating, setCreating] = useState(false)
  
  // Calendar navigation state
  const [currentMonth, setCurrentMonth] = useState(new Date())
  
  // Popover state for day click
  const [popoverDate, setPopoverDate] = useState<Date | null>(null)
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 })
  const popoverRef = useRef<HTMLDivElement>(null)
  
  // Form state
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [recipientType, setRecipientType] = useState<'everyone' | 'specific'>('everyone')
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([])
  const [members, setMembers] = useState<Array<{id: string, name: string}>>([])
  const [memberSearch, setMemberSearch] = useState('')
  
  // Confirm cancel dialog state
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancelNotificationId, setCancelNotificationId] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [cancelling, setCancelling] = useState(false)
  
  // View notification details dialog state
  const [viewNotification, setViewNotification] = useState<Notification | null>(null)

  useEffect(() => {
    loadData()
    loadMembers()
  }, [])

  const loadMembers = async () => {
    try {
      const res = await fetch('/api/members')
      if (res.ok) {
        const data = await res.json()
        setMembers(data.members || [])
      }
    } catch (err) {
      console.error('Failed to load members:', err)
    }
  }

  // Close popover on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setPopoverDate(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadData = async () => {
    try {
      const [notifRes, eventsRes] = await Promise.all([
        fetch('/api/notifications'),
        fetch('/api/events')
      ])
      
      if (notifRes.ok) {
        const data = await notifRes.json()
        setNotifications(data.notifications || [])
      }
      
      if (eventsRes.ok) {
        const data = await eventsRes.json()
        setEvents(data.events || [])
      }
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Format date to YYYY-MM-DD without timezone issues
  const formatDateForApi = (date: Date) => {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const handleCreate = async () => {
    if (!title.trim()) {
      showToast('Please enter a title', 'error')
      return
    }
    if (!message.trim()) {
      showToast('Please enter a message', 'error')
      return
    }
    if (!selectedDate) {
      showToast('Please select a date', 'error')
      return
    }
    if (recipientType === 'specific' && selectedRecipients.length === 0) {
      showToast('Please select at least one recipient', 'error')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          scheduled_date: formatDateForApi(selectedDate),
          recipient_type: recipientType,
          recipient_ids: recipientType === 'specific' ? selectedRecipients : null
        })
      })

      if (res.ok) {
        showToast('Notification scheduled successfully!', 'success')
        setShowCreateDialog(false)
        setTitle('')
        setMessage('')
        setSelectedDate(undefined)
        setPopoverDate(null)
        setRecipientType('everyone')
        setSelectedRecipients([])
        setMemberSearch('')
        loadData() // Refresh data to show new notification
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to create notification', 'error')
      }
    } catch (err) {
      showToast('Failed to create notification', 'error')
    } finally {
      setCreating(false)
    }
  }

  const openCancelDialog = (id: string) => {
    setCancelNotificationId(id)
    setConfirmText('')
    setShowCancelDialog(true)
  }

  const handleCancel = async () => {
    if (!cancelNotificationId) return
    if (confirmText.toLowerCase() !== 'confirm') {
      showToast('Please type "confirm" to cancel', 'error')
      return
    }
    
    setCancelling(true)
    try {
      const res = await fetch(`/api/notifications?id=${cancelNotificationId}&action=cancel`, { method: 'DELETE' })
      if (res.ok) {
        showToast('Notification cancelled', 'success')
        setShowCancelDialog(false)
        setCancelNotificationId(null)
        setConfirmText('')
        setPopoverDate(null) // Close popover
        loadData() // Refresh data to update yellow dots
      } else {
        showToast('Failed to cancel notification', 'error')
      }
    } catch (err) {
      showToast('Failed to cancel notification', 'error')
    } finally {
      setCancelling(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this notification?')) return
    try {
      const res = await fetch(`/api/notifications?id=${id}&action=delete`, { method: 'DELETE' })
      if (res.ok) {
        showToast('Notification deleted', 'success')
        loadData()
      } else {
        showToast('Failed to delete notification', 'error')
      }
    } catch (err) {
      showToast('Failed to delete notification', 'error')
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return ''
    try {
      const [hours, minutes] = timeStr.split(':')
      const hour = parseInt(hours)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const hour12 = hour % 12 || 12
      return `${hour12}:${minutes} ${ampm}`
    } catch {
      return timeStr
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs"><IconClock className="size-3 mr-1" />Pending</Badge>
      case 'sent':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs"><IconCheck className="size-3 mr-1" />Sent</Badge>
      case 'failed':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs"><IconX className="size-3 mr-1" />Failed</Badge>
      case 'cancelled':
        return <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 text-xs">Cancelled</Badge>
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>
    }
  }

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: (Date | null)[] = []
    
    // Add empty slots for days before the first day of the month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null)
    }
    
    // Add all days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i))
    }
    
    return days
  }

  // Format date to YYYY-MM-DD without timezone issues
  const formatDateKey = (date: Date) => {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getEventsForDate = (date: Date) => {
    const dateKey = formatDateKey(date)
    console.log('Looking for events on:', dateKey, 'Found:', events.filter(e => e.event_date === dateKey).length)
    return events.filter(e => e.event_date === dateKey)
  }

  const getNotificationsForDate = (date: Date) => {
    const dateKey = formatDateKey(date)
    return notifications.filter(n => {
      // Handle both full ISO timestamps and YYYY-MM-DD formats
      const notifDate = n.scheduled_date.split('T')[0]
      return notifDate === dateKey && n.status === 'pending'
    })
  }

  const hasEvents = (date: Date) => getEventsForDate(date).length > 0
  const hasNotifications = (date: Date) => getNotificationsForDate(date).length > 0

  const handleDayClick = (date: Date, event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect()
    setPopoverPosition({
      top: rect.bottom + window.scrollY + 8,
      left: Math.min(rect.left + window.scrollX, window.innerWidth - 320)
    })
    setPopoverDate(date)
  }

  const openScheduleDialog = () => {
    if (popoverDate) {
      setSelectedDate(popoverDate)
      setPopoverDate(null)
      setShowCreateDialog(true)
    }
  }

  const days = getDaysInMonth(currentMonth)
  const monthName = currentMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get upcoming events for sidebar
  const upcomingEvents = [...events]
    .filter(e => new Date(e.event_date) >= today)
    .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
    .slice(0, 5)

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Calendar & Notifications</h1>
          <p className="text-muted-foreground text-sm mt-1">Schedule messages and view upcoming events</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Section */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Calendar</CardTitle>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                >
                  <IconChevronLeft className="size-4" />
                </Button>
                <span className="font-medium min-w-[140px] text-center">{monthName}</span>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                >
                  <IconChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((date, i) => {
                if (!date) {
                  return <div key={`empty-${i}`} className="aspect-square" />
                }
                
                const isToday = formatDateKey(date) === formatDateKey(today)
                const hasEvt = hasEvents(date)
                const hasNotif = hasNotifications(date)
                const isSelected = popoverDate && formatDateKey(date) === formatDateKey(popoverDate)
                
                return (
                  <button
                    key={formatDateKey(date)}
                    onClick={(e) => handleDayClick(date, e)}
                    className={`
                      aspect-square p-1 rounded-full flex flex-col items-center justify-center relative
                      hover:bg-muted/80 transition-colors text-sm
                      ${isToday ? 'bg-primary text-primary-foreground font-bold' : ''}
                      ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}
                    `}
                  >
                    <span>{date.getDate()}</span>
                    {/* Dots indicator */}
                    {(hasEvt || hasNotif) && (
                      <div className="flex gap-0.5 absolute bottom-1">
                        {hasEvt && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                        {hasNotif && <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            
            {/* Legend */}
            <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span>Event</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                <span>Scheduled Message</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Events */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <IconCalendarEvent className="size-5" />
                Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2].map(i => (
                    <div key={i} className="h-16 bg-muted/50 rounded animate-pulse" />
                  ))}
                </div>
              ) : upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No upcoming events</p>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.map((event) => (
                    <div 
                      key={event.id} 
                      className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/events/${event.id}`)}
                    >
                      <h4 className="font-medium text-sm truncate">{event.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(event.event_date)}
                        {event.start_time && ` • ${formatTime(event.start_time)}`}
                      </p>
                    </div>
                  ))}
                  {events.filter(e => new Date(e.event_date) >= today).length > 5 && (
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => router.push('/events')}>
                      View all events
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Notifications */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <IconBell className="size-5" />
                Pending Messages
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2].map(i => (
                    <div key={i} className="h-16 bg-muted/50 rounded animate-pulse" />
                  ))}
                </div>
              ) : notifications.filter(n => n.status === 'pending').length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No pending messages</p>
              ) : (
                <div className="space-y-2">
                  {notifications.filter(n => n.status === 'pending').slice(0, 5).map((notif) => (
                    <div 
                      key={notif.id} 
                      className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setViewNotification(notif)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{notif.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1">{formatDate(notif.scheduled_date)}</p>
                        </div>
                        {isAdmin && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="size-7" 
                            onClick={(e) => {
                              e.stopPropagation()
                              openCancelDialog(notif.id)
                            }}
                          >
                            <IconX className="size-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Day Popover */}
      {popoverDate && (
        <div 
          ref={popoverRef}
          className="fixed z-50 bg-popover border rounded-lg shadow-lg p-4 w-80"
          style={{ top: popoverPosition.top, left: popoverPosition.left }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">
              {popoverDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
            <Button variant="ghost" size="icon" className="size-6" onClick={() => setPopoverDate(null)}>
              <IconX className="size-4" />
            </Button>
          </div>
          
          {/* Events for this day */}
          {getEventsForDate(popoverDate).length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500" /> Events ({getEventsForDate(popoverDate).length})
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {getEventsForDate(popoverDate).map(event => (
                  <div 
                    key={event.id} 
                    className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded text-sm cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-950/50 border border-blue-200 dark:border-blue-800"
                    onClick={() => router.push(`/events/${event.id}`)}
                  >
                    <p className="font-semibold">{event.title}</p>
                    {event.start_time && (
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        🕐 {formatTime(event.start_time)} - {formatTime(event.end_time)}
                      </p>
                    )}
                    {event.address && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <IconMapPin className="size-3" /> {event.address}
                      </p>
                    )}
                    {event.organizing_group && (
                      <p className="text-xs text-muted-foreground mt-1">
                        👥 {event.organizing_group}
                      </p>
                    )}
                    {event.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Notifications for this day */}
          {getNotificationsForDate(popoverDate).length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-yellow-500" /> Scheduled Messages
              </p>
              <div className="space-y-2">
                {getNotificationsForDate(popoverDate).map(notif => (
                  <div 
                    key={notif.id} 
                    className="p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded text-sm cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-800"
                    onClick={() => setViewNotification(notif)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium truncate flex-1">{notif.title}</p>
                      {isAdmin && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="size-5" 
                          onClick={(e) => {
                            e.stopPropagation()
                            openCancelDialog(notif.id)
                          }}
                        >
                          <IconX className="size-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* No items message */}
          {getEventsForDate(popoverDate).length === 0 && getNotificationsForDate(popoverDate).length === 0 && (
            <p className="text-sm text-muted-foreground mb-3">No events or messages scheduled</p>
          )}
          
          {/* Schedule button */}
          {isAdmin && (
            <Button className="w-full" size="sm" onClick={openScheduleDialog}>
              <IconPlus className="mr-2 size-4" />
              Schedule Message
            </Button>
          )}
        </div>
      )}

      {/* Create Notification Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Notification</DialogTitle>
            <DialogDescription>
              Schedule a message for {selectedDate?.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Monthly Meeting Reminder"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter the message to send..."
                rows={4}
                className="mt-1"
              />
              <div className="mt-2 p-3 bg-muted/50 rounded-md text-xs text-muted-foreground">
                <p className="font-medium mb-1">Message will be sent as:</p>
                <p className="italic">Salam [Member Name],</p>
                <p className="italic my-1">[Your message here]</p>
                <p className="italic">Kind Regards - Mesaq Association</p>
              </div>
            </div>

            {/* Recipient Selection */}
            <div>
              <Label>Recipients *</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={recipientType === 'everyone' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setRecipientType('everyone')
                    setSelectedRecipients([])
                  }}
                >
                  Everyone
                </Button>
                <Button
                  type="button"
                  variant={recipientType === 'specific' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRecipientType('specific')}
                >
                  Specific People
                </Button>
              </div>
              
              {recipientType === 'specific' && (
                <div className="mt-3 space-y-2">
                  <Input
                    placeholder="Search members..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="text-sm"
                  />
                  <div className="max-h-32 overflow-y-auto border rounded-md">
                    {members
                      .filter(m => m.name.toLowerCase().includes(memberSearch.toLowerCase()))
                      .slice(0, 20)
                      .map(m => (
                        <div
                          key={m.id}
                          className={`px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 flex items-center gap-2 ${
                            selectedRecipients.includes(m.id) ? 'bg-primary/10' : ''
                          }`}
                          onClick={() => {
                            if (selectedRecipients.includes(m.id)) {
                              setSelectedRecipients(selectedRecipients.filter(id => id !== m.id))
                            } else {
                              setSelectedRecipients([...selectedRecipients, m.id])
                            }
                          }}
                        >
                          <div className={`size-4 rounded border flex items-center justify-center ${
                            selectedRecipients.includes(m.id) ? 'bg-primary border-primary' : 'border-muted-foreground'
                          }`}>
                            {selectedRecipients.includes(m.id) && <IconCheck className="size-3 text-primary-foreground" />}
                          </div>
                          {m.name}
                        </div>
                      ))}
                  </div>
                  {selectedRecipients.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {selectedRecipients.length} recipient{selectedRecipients.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                onClick={handleCreate} 
                disabled={creating || !title.trim() || !message.trim() || !selectedDate || (recipientType === 'specific' && selectedRecipients.length === 0)}
                className="flex-1"
              >
                <IconSend className="mr-2 size-4" />
                {creating ? 'Scheduling...' : 'Schedule'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCreateDialog(false)
                  setTitle('')
                  setMessage('')
                  setRecipientType('everyone')
                  setSelectedRecipients([])
                  setMemberSearch('')
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Notification Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCancelDialog(false)
          setCancelNotificationId(null)
          setConfirmText('')
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Scheduled Message</DialogTitle>
            <DialogDescription>
              This will cancel the scheduled message. It will not be sent to members.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2">
            <Label htmlFor="confirm-cancel">Type "confirm" to cancel this message</Label>
            <Input
              id="confirm-cancel"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="confirm"
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowCancelDialog(false)
                setCancelNotificationId(null)
                setConfirmText('')
              }}
            >
              Keep Message
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCancel}
              disabled={cancelling || confirmText.toLowerCase() !== 'confirm'}
            >
              {cancelling ? 'Cancelling...' : 'Cancel Message'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Notification Details Dialog */}
      <Dialog open={!!viewNotification} onOpenChange={(open) => {
        if (!open) setViewNotification(null)
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{viewNotification?.title}</DialogTitle>
            <DialogDescription>
              Scheduled for {viewNotification && formatDate(viewNotification.scheduled_date)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground text-xs">Message</Label>
              <div className="mt-1 p-3 bg-muted/50 rounded-md whitespace-pre-wrap text-sm">
                {viewNotification?.message}
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <div>
                <span className="font-medium">Status:</span>{' '}
                {viewNotification && getStatusBadge(viewNotification.status)}
              </div>
              <div>
                <span className="font-medium">Sending to:</span>{' '}
                {viewNotification?.recipient_type === 'specific' 
                  ? `${viewNotification?.recipient_ids?.length || 0} specific people` 
                  : 'Everyone'}
              </div>
              {viewNotification?.recipients_count != null && viewNotification.recipients_count > 0 && (
                <div>
                  <span className="font-medium">Sent to:</span> {viewNotification.recipients_count}
                </div>
              )}
            </div>
            
            {viewNotification?.created_by_name && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Created by:</span> {viewNotification.created_by_name}
              </div>
            )}
          </div>

          <DialogFooter>
            {isAdmin && viewNotification?.status === 'pending' && (
              <Button 
                variant="destructive" 
                onClick={() => {
                  if (viewNotification) {
                    setViewNotification(null)
                    openCancelDialog(viewNotification.id)
                  }
                }}
              >
                Cancel Message
              </Button>
            )}
            <Button variant="outline" onClick={() => setViewNotification(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
