import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { getUserFromToken } from '@/lib/getUserFromToken'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import EventsClient from '../events/EventsClient'
import { Pool } from 'pg'

export default async function MeetingsPage() {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) redirect('/')
  
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    redirect('/')
  }
  
  const user = await getUserFromToken()

  let rows: any[] = []
  
  try {
    const pool = new (require('pg').Pool)({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
    }) as Pool
    
    const result = await pool.query(`
      SELECT 
        id, 
        title, 
        description, 
        address, 
        to_char(event_date, 'YYYY-MM-DD') as event_date,
        start_time, 
        end_time, 
        event_type, 
        estimated_cost, 
        attendees,
        completed,
        completed_at
      FROM events 
      WHERE event_type = 'Meeting'
      ORDER BY event_date ASC, start_time ASC 
      LIMIT 200
    `)
    rows = result.rows
  } catch (error) {
    console.error('Error fetching meetings:', error)
  }

  return (
    <MainLayout user={user}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Meetings</h1>
          <Link href="/meetings/create">
            <Button>Create New</Button>
          </Link>
        </div>
        <EventsClient initial={rows} />
      </div>
    </MainLayout>
  )
}


