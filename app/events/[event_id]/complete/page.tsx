import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { getUserFromToken } from '@/lib/getUserFromToken'
import { Pool } from 'pg'
import CompleteEventForm from './CompleteEventForm'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { IconArrowLeft } from '@tabler/icons-react'

export default async function CompleteEventPage({ params }: { params: { event_id: string } }) {
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
      'SELECT id, title, event_type FROM events WHERE id = $1',
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

  return (
    <MainLayout user={user}>
      <div className="p-6 max-w-3xl">
        <Link href={`/events/${event.id}`}>
          <Button variant="ghost" className="mb-4">
            <IconArrowLeft className="size-4 mr-2" />
            Back to Event
          </Button>
        </Link>

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Mark as Completed</h1>
          <p className="text-muted-foreground">Complete details for: {event.title}</p>
        </div>

        <CompleteEventForm eventId={event.id} eventType={event.event_type} />
      </div>
    </MainLayout>
  )
}

