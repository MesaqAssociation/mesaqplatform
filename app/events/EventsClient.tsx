"use client"

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { IconCalendar, IconClock, IconMapPin, IconUsers } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'

type Event = {
  id: string
  title: string
  description: string | null
  address: string | null
  event_date: string
  start_time: string
  end_time: string
  event_type: string
  estimated_cost: number | null
  attendees: string[]
  completed?: boolean
  completed_at?: string
}

type Props = {
  initial: Event[]
  userRole?: string
}

export default function EventsClient({ initial, userRole }: Props) {
  // Format time to 12-hour
  function formatTime(time: string) {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const period = hour < 12 ? 'AM' : 'PM'
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${h12}:${minutes} ${period}`
  }

  // Format date - robust handling
  function formatDate(dateStr: string) {
    try {
      // Handle YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split('-').map(Number)
        const date = new Date(year, month - 1, day)
        return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
      }
      
      // Fallback: try parsing with T00:00:00
      const date = new Date(dateStr + 'T00:00:00')
      if (isNaN(date.getTime())) {
        return dateStr // Return original if parsing fails
      }
      return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    } catch (error) {
      console.error('Date formatting error:', error, dateStr)
      return dateStr
    }
  }

  // Get event status
  function getEventStatus(event: Event) {
    if (event.completed) {
      return { label: 'Completed', color: 'bg-green-100 text-green-700' }
    }
    
    const eventDate = new Date(event.event_date + 'T' + event.start_time)
    const now = new Date()
    
    if (eventDate < now) {
      return { label: 'Past', color: 'bg-gray-100 text-gray-700' }
    }
    
    return { label: 'Scheduled', color: 'bg-blue-100 text-blue-700' }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {initial.map(event => {
        const status = getEventStatus(event)
        return (
          <Link key={event.id} href={`/events/${event.id}`}>
            <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <CardTitle className="line-clamp-2 flex-1">{event.title}</CardTitle>
                  <Badge className={status.color}>{status.label}</Badge>
                </div>
                <CardDescription className="line-clamp-2">
                  {event.description || 'No description'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconCalendar className="size-4" />
                  <span>{formatDate(event.event_date)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconClock className="size-4" />
                  <span>{formatTime(event.start_time)} - {formatTime(event.end_time)}</span>
                </div>
                {event.address && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <IconMapPin className="size-4" />
                    <span className="line-clamp-1">{event.address}</span>
                  </div>
                )}
                {event.attendees && event.attendees.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <IconUsers className="size-4" />
                    <span>{event.attendees.join(', ')}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

