import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { getUserFromToken } from '@/lib/getUserFromToken'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import EventsClient from './EventsClient'
import { Pool } from 'pg'

export default async function EventsPage() {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) redirect('/')
  
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    redirect('/')
  }
  
  const user = await getUserFromToken()

  const pool = new (require('pg').Pool)({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  }) as Pool
  
  const { rows } = await pool.query(`
    SELECT id, title, description, address, event_date, start_time, end_time, event_type, estimated_cost, attendees 
    FROM events 
    WHERE event_type = 'Event'
    ORDER BY event_date ASC, start_time ASC 
    LIMIT 200
  `)

  return (
    <MainLayout user={user}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Events</h1>
          <Link href="/events/create">
            <Button>Create New</Button>
          </Link>
        </div>
        <EventsClient initial={rows} />
      </div>
    </MainLayout>
  )
}


