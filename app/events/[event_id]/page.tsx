import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { getUserFromToken } from '@/lib/getUserFromToken'
import { Pool } from 'pg'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { IconArrowLeft, IconCalendar, IconClock, IconUsers, IconMapPin, IconCurrencyDollar, IconCheck, IconPhoto, IconFileText, IconUsersGroup } from '@tabler/icons-react'
import EventActions from './EventActions'

export default async function EventDetailPage({ params }: { params: { event_id: string } }) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) redirect('/')
  
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    redirect('/')
  }
  
  const user = await getUserFromToken()
  
  // Check if user is admin/board
  const userRole = (user?.role || '').toLowerCase()
  const isAdminOrBoard = ['admin', 'board', 'manager', 'head', 'finance officer', 'logistics officer', 'public officer'].includes(userRole)
  
  let event: any = null
  let attendeeNames: string[] = []
  
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
    
    // Fetch attendee names if attendees exist
    if (event.attendees) {
      let attendeeIds: string[] = []
      if (Array.isArray(event.attendees)) {
        attendeeIds = event.attendees
      } else if (typeof event.attendees === 'string') {
        try {
          attendeeIds = JSON.parse(event.attendees)
        } catch {
          attendeeIds = event.attendees.split(',').map((s: string) => s.trim())
        }
      }
      
      if (attendeeIds.length > 0) {
        const { rows: memberRows } = await pool.query(
          'SELECT name FROM users WHERE id = ANY($1) ORDER BY name ASC',
          [attendeeIds]
        )
        attendeeNames = memberRows.map(r => r.name).filter(Boolean)
      }
    }
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
    <MainLayout user={{ ...user, role: user?.role }}>
      <div className="p-6 max-w-4xl">
        <Link href={backUrl}>
          <Button variant="ghost" className="mb-4">
            <IconArrowLeft className="size-4 mr-2" />
            Back to {event.event_type === 'Meeting' ? 'Meetings' : 'Events'}
          </Button>
        </Link>

        <div className="space-y-6">
          <div>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <h1 className="text-3xl font-bold">{event.title}</h1>
                {event.description && (
                  <p className="text-muted-foreground mt-2">{event.description}</p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0 items-center">
                {event.completed && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-sm font-medium">
                    <IconCheck className="size-4" />
                    Completed
                  </span>
                )}
                {isAdminOrBoard && !event.completed && (
                  <>
                    <Link href={`/events/${event.id}/complete`}>
                      <Button variant="outline">Mark as Completed</Button>
                    </Link>
                    <EventActions 
                      eventId={event.id} 
                      eventTitle={event.title} 
                      backUrl={backUrl} 
                    />
                  </>
                )}
                {isAdminOrBoard && event.completed && (
                  <EventActions 
                    eventId={event.id} 
                    eventTitle={event.title} 
                    backUrl={backUrl} 
                  />
                )}
              </div>
            </div>
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

            {event.organizing_group && (
              <div className="flex items-start gap-3 p-4 border rounded-lg">
                <IconUsersGroup className="size-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Organizing Group</div>
                  <div className="text-sm text-muted-foreground">{event.organizing_group}</div>
                </div>
              </div>
            )}

            {attendeeNames.length > 0 && (
              <div className="flex items-start gap-3 p-4 border rounded-lg col-span-full">
                <IconUsers className="size-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Attendees ({attendeeNames.length})</div>
                  <div className="text-sm text-muted-foreground">
                    {attendeeNames.join(', ')}
                  </div>
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

          {/* Completed Event Results */}
          {event.completed && (
            <div className="border rounded-lg p-6 bg-green-50/50 dark:bg-green-900/10">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <IconCheck className="size-5 text-green-600" />
                Event Results
              </h2>
              <div className="space-y-4">
                {event.completion_summary && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Summary</h3>
                    <p className="text-sm whitespace-pre-wrap">{event.completion_summary}</p>
                  </div>
                )}
                
                {event.final_cost && (
                  <div className="flex items-center gap-3">
                    <IconCurrencyDollar className="size-5 text-green-600" />
                    <div>
                      <span className="text-sm text-muted-foreground">Final Cost: </span>
                      <span className="font-semibold">${parseFloat(event.final_cost).toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {event.completion_files && (() => {
                  let files: string[] = []
                  try {
                    files = typeof event.completion_files === 'string' 
                      ? JSON.parse(event.completion_files) 
                      : event.completion_files
                  } catch {}
                  
                  if (files.length > 0) {
                    return (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                          <IconPhoto className="size-4" />
                          Attached Files ({files.length})
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {files.map((fileUrl: string, idx: number) => {
                            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl)
                            return (
                              <a 
                                key={idx} 
                                href={fileUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="block border rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                              >
                                {isImage ? (
                                  <div className="relative aspect-video bg-muted">
                                    <img 
                                      src={fileUrl} 
                                      alt={`Event file ${idx + 1}`} 
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="p-4 flex items-center gap-2 bg-muted/50">
                                    <IconFileText className="size-5" />
                                    <span className="text-sm truncate">File {idx + 1}</span>
                                  </div>
                                )}
                              </a>
                            )
                          })}
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}

                {event.completed_at && (
                  <p className="text-xs text-muted-foreground">
                    Completed on {new Date(event.completed_at).toLocaleDateString('en-US', { 
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                    })}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}

