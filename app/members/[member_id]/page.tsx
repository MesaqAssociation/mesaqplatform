import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { getUserFromToken } from '@/lib/getUserFromToken'
import { Pool } from 'pg'
import MemberDetailClient from './MemberDetailClient'

export default async function MemberDetailPage({ 
  params 
}: { 
  params: Promise<{ member_id: string }> | { member_id: string }
}) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) redirect('/')
  
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    redirect('/')
  }
  
  const user = await getUserFromToken()

  // Await params if it's a Promise (Next.js 15+)
  const resolvedParams = params instanceof Promise ? await params : params
  const memberId = parseInt(resolvedParams.member_id)

  if (isNaN(memberId)) {
    redirect('/members')
  }

  const pool = new (require('pg').Pool)({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  }) as Pool

  try {
    // Fetch member details
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE member_id = $1',
      [memberId]
    )

    if (rows.length === 0) {
      redirect('/members')
    }

    const member = rows[0]

    // Fetch member's attended events
    const { rows: attendedEvents } = await pool.query(
      `SELECT e.* FROM events e 
       JOIN member_events me ON e.id = me.event_id 
       WHERE me.user_id = $1 
       ORDER BY e.event_date DESC`,
      [member.id]
    )

    // Fetch all events for selection
    const { rows: allEvents } = await pool.query(
      'SELECT id, title, event_date, event_type FROM events ORDER BY event_date DESC'
    )

    return (
      <MainLayout user={user}>
        <MemberDetailClient 
          member={member} 
          attendedEvents={attendedEvents}
          allEvents={allEvents}
        />
      </MainLayout>
    )
  } catch (error) {
    console.error('Error fetching member details:', error)
    redirect('/members')
  }
}

