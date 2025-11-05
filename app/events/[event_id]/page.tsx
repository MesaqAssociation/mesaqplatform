import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { getUserFromToken } from '@/lib/getUserFromToken'
import { Pool } from 'pg'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { IconArrowLeft, IconCalendar, IconClock, IconUsers, IconMapPin, IconCurrencyDollar } from '@tabler/icons-react'

export default async function EventDetailPage({ params }: { params: { event_id: string } }) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) redirect('/')
  
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    redirect('/')
  }
  
  const user = await getUserFromToken()
  
  let event: any = null
  
  try {
    const pool = new (require('pg').Pool)({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
    }) as Pool

    const { rows } = await pool.query(
      'SELECT * FROM events WHERE id = $1',
      [params.event_id]
    )

    if (rows.length === 0) {
      redirect('/events')
    }

    event = rows[0]
  } catch (error) {
    console.error('Error fetching event:', error)
    redirect('/events')
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  }

  const formatTime = (timeStr: string) => {
    if (!timeStr) return ''
    const [hours, minutes] = timeStr.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const backUrl = event.event_type === 'Meeting' ? '/meetings' : '/events'

  return (
    <MainLayout user={user}>
      <div className="p-6 max-w-4xl">
        <Link href={backUrl}>
          <Button variant="ghost" className="mb-4">
            <IconArrowLeft className="size-4 mr-2" />
            Back to {event.event_type === 'Meeting' ? 'Meetings' : 'Events'}
          </Button>
        </Link>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs px-2 py-1 rounded-full ${
                event.event_type === 'Meeting' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-purple-100 text-purple-700'
              }`}>
                {event.event_type}
              </span>
            </div>
            <h1 className="text-3xl font-bold">{event.title}</h1>
            {event.description && (
              <p className="text-muted-foreground mt-2">{event.description}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <IconCalendar className="size-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Date</div>
                <div className="text-sm text-muted-foreground">{formatDate(event.event_date)}</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <IconClock className="size-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Time</div>
                <div className="text-sm text-muted-foreground">
                  {formatTime(event.start_time)} - {formatTime(event.end_time)}
                </div>
              </div>
            </div>

            {event.address && (
              <div className="flex items-start gap-3 p-4 border rounded-lg">
                <IconMapPin className="size-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Location</div>
                  <div className="text-sm text-muted-foreground">{event.address}</div>
                </div>
              </div>
            )}

            {event.estimated_cost && (
              <div className="flex items-start gap-3 p-4 border rounded-lg">
                <IconCurrencyDollar className="size-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Estimated Cost</div>
                  <div className="text-sm text-muted-foreground">${parseFloat(event.estimated_cost).toFixed(2)}</div>
                </div>
              </div>
            )}

            {event.attendees && (
              <div className="flex items-start gap-3 p-4 border rounded-lg col-span-full">
                <IconUsers className="size-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Attendees</div>
                  <div className="text-sm text-muted-foreground">{event.attendees}</div>
                </div>
              </div>
            )}
          </div>

          {event.agenda && (() => {
            try {
              const agendaData = typeof event.agenda === 'string' ? JSON.parse(event.agenda) : event.agenda
              if (Array.isArray(agendaData) && agendaData.length > 0) {
                return (
                  <div className="border rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">Agenda</h2>
                    <div className="space-y-2">
                      {agendaData.map((item: any, index: number) => (
                        <div key={index} className="flex gap-3 pb-2 border-b last:border-0">
                          <div className="text-sm text-muted-foreground w-20">{item.time}</div>
                          <div className="flex-1 text-sm">{item.title}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }
            } catch (e) {
              console.error('Error parsing agenda:', e)
            }
            return null
          })()}
        </div>
      </div>
    </MainLayout>
  )
}

