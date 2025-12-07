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
  const memberId = resolvedParams.member_id

  const pool = new (require('pg').Pool)({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  }) as Pool

  try {
    // Fetch member details by ID (UUID)
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE id = $1',
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

    // Fetch member's transactions (where they are the category OR matched_member_id)
    const { rows: transactions } = await pool.query(
      `SELECT 
        t.id,
        to_char(t.transaction_date, 'YYYY-MM-DD') as transaction_date,
        t.transaction_name,
        t.description,
        t.amount,
        t.transaction_type,
        t.category,
        t.balance_after,
        t.source
      FROM transactions t
      WHERE t.category = $1 OR t.matched_member_id = $2
      ORDER BY t.transaction_date DESC
      LIMIT 50`,
      [member.name, member.id]
    )

    // Format dates to strings for client component
    const formattedMember = {
      ...member,
      member_id: member.member_id || null,
      created_at: member.created_at ? new Date(member.created_at).toISOString() : null,
      date_joined: member.date_joined ? new Date(member.date_joined).toISOString().split('T')[0] : null,
      household_members: member.household_members || 0,
    }

    const formattedAttendedEvents = attendedEvents.map(event => ({
      ...event,
      event_date: event.event_date ? new Date(event.event_date).toISOString().split('T')[0] : null,
    }))

    const formattedAllEvents = allEvents.map(event => ({
      ...event,
      event_date: event.event_date ? new Date(event.event_date).toISOString().split('T')[0] : null,
    }))

    return (
      <MainLayout user={user}>
        <MemberDetailClient 
          member={formattedMember} 
          attendedEvents={formattedAttendedEvents}
          allEvents={formattedAllEvents}
          transactions={transactions}
        />
      </MainLayout>
    )
  } catch (error) {
    console.error('Error fetching member details:', error)
    redirect('/members')
  }
}

