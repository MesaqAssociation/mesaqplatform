"use client"

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { IconCalendar, IconClock, IconMapPin, IconUsers } from '@tabler/icons-react'

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
}

export default function EventsClient({ initial }: { initial: Event[] }) {
  // Format time to 12-hour
  function formatTime(time: string) {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const period = hour < 12 ? 'AM' : 'PM'
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${h12}:${minutes} ${period}`
  }

  // Format date
  function formatDate(date: string) {
    const d = new Date(date + 'T00:00:00')
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {initial.map(event => (
        <Link key={event.id} href={`/events/${event.id}`}>
          <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="line-clamp-2">{event.title}</CardTitle>
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
      ))}
    </div>
  )
}

