"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import EventsClient from '../events/EventsClient'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

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
  userRole?: string
}

export default function MeetingsClientWrapper({ userRole }: Props) {
  const [meetings, setMeetings] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  const isAdminOrBoard = ['admin', 'board', 'manager', 'head', 'finance officer', 'logistics officer', 'public officer'].includes((userRole || '').toLowerCase())

  useEffect(() => {
    loadMeetings()
  }, [])

  const loadMeetings = async () => {
    try {
      const res = await fetch('/api/events/list?type=Meeting')
      if (res.ok) {
        const data = await res.json()
        setMeetings(data.events || [])
      }
    } catch (err) {
      console.error('Failed to load meetings:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Meetings</h1>
        {isAdminOrBoard && (
          <Link href="/meetings/create">
            <Button>Create New</Button>
          </Link>
        )}
      </div>
      
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="h-full">
              <CardContent className="pt-6">
                <Skeleton className="h-6 w-3/4 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6 mb-4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EventsClient initial={meetings} userRole={userRole} />
      )}
    </div>
  )
}
