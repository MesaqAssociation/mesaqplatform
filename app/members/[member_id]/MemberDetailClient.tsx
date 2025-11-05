"use client"

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { IconArrowLeft, IconMail, IconPhone, IconMapPin, IconCalendar, IconUsers, IconCreditCard, IconUserCircle } from '@tabler/icons-react'

type Member = {
  id: string
  member_id: number
  name: string
  email: string | null
  phone: string
  address: string | null
  image: string | null
  role: string
  banking_name: string | null
  date_joined: string | null
  household_members: number
  created_at: string
}

type Event = {
  id: string
  title: string
  event_date: string
  event_type: string
  description?: string | null
  address?: string | null
}

export default function MemberDetailClient({ 
  member, 
  attendedEvents, 
  allEvents 
}: { 
  member: Member
  attendedEvents: Event[]
  allEvents: Event[]
}) {
  const [events, setEvents] = useState<Event[]>(attendedEvents)
  const [loading, setLoading] = useState(false)

  async function addEvent(eventId: string) {
    setLoading(true)
    try {
      const res = await fetch('/api/members/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id, eventId }),
      })
      if (res.ok) {
        const event = allEvents.find(e => e.id === eventId)
        if (event) {
          setEvents([event, ...events])
        }
      }
    } catch (err) {
      console.error('Failed to add event', err)
    } finally {
      setLoading(false)
    }
  }

  async function removeEvent(eventId: string) {
    try {
      await fetch('/api/members/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id, eventId }),
      })
      setEvents(events.filter(e => e.id !== eventId))
    } catch (err) {
      console.error('Failed to remove event', err)
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date + 'T00:00:00').toLocaleDateString('en-AU', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    })
  }

  const availableEvents = allEvents.filter(e => !events.find(ae => ae.id === e.id))

  return (
    <div className="p-6 max-w-6xl">
      <Link href="/members">
        <Button variant="ghost" className="mb-4">
          <IconArrowLeft className="mr-2 size-4" />
          Back to Members
        </Button>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-32 w-32 mb-4">
                  <AvatarImage src={member.image || '/placeholder-user.jpg'} alt={member.name} />
                  <AvatarFallback className="text-4xl">{member.name?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <h1 className="text-2xl font-semibold mb-2">{member.name}</h1>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-4 ${
                  member.role === 'Head Board Member' 
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    : member.role === 'Board Member'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                }`}>
                  {member.role}
                </span>
                <p className="text-sm text-muted-foreground">Member #{member.member_id}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <IconMail className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{member.email || '-'}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <IconPhone className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{member.phone}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <IconMapPin className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{member.address || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Member Details */}
          <Card>
            <CardHeader>
              <CardTitle>Member Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <IconUsers className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Household Members</p>
                  <p className="font-medium">{member.household_members}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <IconCalendar className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Date Joined</p>
                  <p className="font-medium">{formatDate(member.date_joined)}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <IconCreditCard className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Banking Name</p>
                  <p className="font-medium">{member.banking_name || '-'}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <IconUserCircle className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Account Created</p>
                  <p className="font-medium">{formatDate(member.created_at?.split('T')[0])}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Events Attended */}
          <Card>
            <CardHeader>
              <CardTitle>Events Attended</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Add Event</label>
                <div className="flex gap-2">
                  <Select onValueChange={addEvent} disabled={loading || availableEvents.length === 0}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={availableEvents.length === 0 ? "No events available" : "Select an event..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEvents.map(event => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.title} ({formatDate(event.event_date)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No events attended yet</p>
                ) : (
                  events.map(event => (
                    <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="font-medium">{event.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(event.event_date)} • {event.event_type}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEvent(event.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

