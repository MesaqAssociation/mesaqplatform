"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { IconPlus, IconBell, IconTrash, IconSend, IconCheck, IconX, IconClock, IconCalendarEvent, IconMapPin } from '@tabler/icons-react'
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
}

type Event = {
  id: string
  title: string
  description: string | null
  event_date: string
  event_time: string | null
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
  
  // Form state
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Load notifications and events in parallel
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
        // Only show future events
        const today = new Date().toISOString().split('T')[0]
        const futureEvents = (data.events || []).filter((e: Event) => e.event_date >= today)
        setEvents(futureEvents)
      }
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
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

    setCreating(true)
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          scheduled_date: selectedDate.toISOString().split('T')[0]
        })
      })

      if (res.ok) {
        showToast('Notification scheduled successfully!', 'success')
        setShowCreateDialog(false)
        setTitle('')
        setMessage('')
        setSelectedDate(undefined)
        loadData()
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

  const handleCancel = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications?id=${id}&action=cancel`, { method: 'DELETE' })
      if (res.ok) {
        showToast('Notification cancelled', 'success')
        loadData()
      } else {
        showToast('Failed to cancel notification', 'error')
      }
    } catch (err) {
      showToast('Failed to cancel notification', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this notification? This cannot be undone.')) {
      return
    }
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

  // Get dates that have notifications or events for highlighting
  const notificationDates = notifications
    .filter(n => n.status === 'pending')
    .map(n => new Date(n.scheduled_date))
  
  const eventDates = events.map(e => new Date(e.event_date))

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
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><IconClock className="size-3 mr-1" />Pending</Badge>
      case 'sent':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><IconCheck className="size-3 mr-1" />Sent</Badge>
      case 'failed':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><IconX className="size-3 mr-1" />Failed</Badge>
      case 'cancelled':
        return <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Sort upcoming items by date
  const upcomingEvents = [...events].sort((a, b) => 
    new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
  ).slice(0, 5)

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Calendar & Notifications</h1>
          <p className="text-muted-foreground text-sm mt-1">Schedule messages and view upcoming events</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <IconPlus className="mr-2 size-4" />
            Schedule Notification
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Section */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Calendar</CardTitle>
            <CardDescription>Click a date to schedule a notification</CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date)
                if (date && isAdmin) {
                  setShowCreateDialog(true)
                }
              }}
              modifiers={{
                hasNotification: notificationDates,
                hasEvent: eventDates
              }}
              modifiersStyles={{
                hasNotification: {
                  backgroundColor: 'hsl(var(--primary) / 0.15)',
                  fontWeight: 'bold'
                },
                hasEvent: {
                  border: '2px solid hsl(var(--primary))',
                  borderRadius: '50%'
                }
              }}
              className="rounded-md border w-full"
            />
            <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-primary/15"></div>
                <span>Notification</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full border-2 border-primary"></div>
                <span>Event</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Events */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <IconCalendarEvent className="size-5" />
                Upcoming Events
              </CardTitle>
              <CardDescription>Events scheduled for the future</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : upcomingEvents.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <IconCalendarEvent className="size-10 mx-auto mb-2 opacity-20" />
                  <p>No upcoming events</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <div 
                      key={event.id} 
                      className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/events/${event.id}`)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-medium">{event.title}</h3>
                          {event.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{event.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>📅 {formatDate(event.event_date)}</span>
                            {event.event_time && <span>🕐 {formatTime(event.event_time)}</span>}
                            {event.organizing_group && (
                              <Badge variant="outline" className="text-xs">{event.organizing_group}</Badge>
                            )}
                          </div>
                          {event.address && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <IconMapPin className="size-3" />
                              <span className="truncate">{event.address}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {events.length > 5 && (
                    <Button 
                      variant="ghost" 
                      className="w-full" 
                      onClick={() => router.push('/events')}
                    >
                      View all {events.length} events
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scheduled Notifications */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <IconBell className="size-5" />
                Scheduled Notifications
              </CardTitle>
              <CardDescription>Messages scheduled to be sent to all members</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <IconBell className="size-10 mx-auto mb-2 opacity-20" />
                  <p>No notifications scheduled</p>
                  {isAdmin && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3"
                      onClick={() => setShowCreateDialog(true)}
                    >
                      Create your first notification
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {notifications.map((notification) => (
                    <div 
                      key={notification.id} 
                      className={`p-4 border rounded-lg ${notification.status === 'cancelled' ? 'opacity-50' : ''}`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium truncate">{notification.title}</h3>
                            {getStatusBadge(notification.status)}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>📅 {formatDate(notification.scheduled_date)}</span>
                            {notification.sent_at && (
                              <span>✉️ Sent to {notification.recipients_count} members</span>
                            )}
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1">
                            {notification.status === 'pending' && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleCancel(notification.id)}
                            title="Cancel notification"
                              >
                                <IconX className="size-4 text-muted-foreground hover:text-orange-500" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDelete(notification.id)}
                              title="Delete notification permanently"
                          >
                            <IconTrash className="size-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                          </div>
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

      {/* Create Notification Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule Notification</DialogTitle>
            <DialogDescription>
              Create a message to be sent to all members on the selected date
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div>
              <Label htmlFor="date">Date</Label>
              <div className="mt-1">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date()}
                  className="rounded-md border"
                />
              </div>
            </div>

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
                placeholder="Enter the message to send to all members..."
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

            <div className="flex gap-2 pt-2">
              <Button 
                onClick={handleCreate} 
                disabled={creating || !title.trim() || !message.trim() || !selectedDate}
                className="flex-1"
              >
                <IconSend className="mr-2 size-4" />
                {creating ? 'Scheduling...' : 'Schedule Notification'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCreateDialog(false)
                  setTitle('')
                  setMessage('')
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
