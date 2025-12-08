"use client"

import { useState, useEffect } from 'react'
import { useI18n } from '@/components/I18nProvider'
import { IconCash, IconCalendarEvent, IconUser, IconArrowRight } from '@tabler/icons-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

type MemberData = {
  id: string
  name: string
  member_id: string | null
  household_members: number
  date_joined: string
}

type Props = {
  initialData: MemberData
}

export default function MemberDashboardClient({ initialData }: Props) {
  const { t } = useI18n()
  const [memberData, setMemberData] = useState(initialData)
  const [balance, setBalance] = useState<{ membershipBalance: number; specialPaymentBalance: number } | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
  const [recentTransactions, setRecentTransactions] = useState<any[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch initial member data first
    fetchMemberData().then(() => {
      // Then load dashboard data
      loadDashboardData()
    })
  }, [])

  const fetchMemberData = async () => {
    try {
      const res = await fetch('/api/user/profile')
      if (res.ok) {
        const data = await res.json()
        setMemberData({
          id: data.id,
          name: data.name || 'Member',
          member_id: data.member_id || null,
          household_members: data.household_members || 1,
          date_joined: data.date_joined || new Date().toISOString()
        })
      }
    } catch (err) {
      console.error('Error loading member data:', err)
    }
  }

  const loadDashboardData = async () => {
    try {
      // Fetch balance
      const balanceRes = await fetch(`/api/membership/balance/${memberData.id}`)
      if (balanceRes.ok) {
        const balanceData = await balanceRes.json()
        console.log('Balance data:', balanceData)
        setBalance(balanceData)
      } else {
        console.error('Balance fetch failed:', balanceRes.status)
      }

      // Fetch payment status
      const statusRes = await fetch(`/api/membership/status/${memberData.id}`)
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        console.log('Status data:', statusData)
        setPaymentStatus(statusData.status)
      } else {
        console.error('Status fetch failed:', statusRes.status)
      }

      // Fetch recent transactions
      const txRes = await fetch(`/api/finance/transactions?memberId=${memberData.id}&limit=5`)
      if (txRes.ok) {
        const txData = await txRes.json()
        console.log('Transactions data:', txData)
        setRecentTransactions(txData.transactions || [])
      } else {
        console.error('Transactions fetch failed:', txRes.status)
      }

      // Fetch upcoming events
      const eventsRes = await fetch(`/api/events/list?limit=5&upcoming=true`)
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json()
        console.log('Events data:', eventsData)
        setUpcomingEvents(eventsData.events || [])
      } else {
        console.error('Events fetch failed:', eventsRes.status)
      }
    } catch (err) {
      console.error('Error loading dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatTime = (timeStr: string) => {
    if (!timeStr) return ''
    const [hours, minutes] = timeStr.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? t('pm') : t('am')
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome {memberData.name}</h1>
        {memberData.member_id && (
          <p className="text-muted-foreground">Member #{memberData.member_id}</p>
        )}
      </div>

      {/* Member Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Account Balance */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-primary/10 p-3 rounded-lg">
                <IconCash className="size-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Account Balance</h2>
            </div>
            {loading ? (
              <>
                <Skeleton className="h-10 w-32 mb-2" />
                <Skeleton className="h-4 w-40" />
              </>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const currentBalance = Number(balance?.membershipBalance?.currentBalance ?? 0)
                  const isNegative = currentBalance < 0
                  return (
                    <p className={`text-3xl font-bold ${isNegative ? 'text-red-500' : 'text-green-500'}`}>
                      ${Math.abs(currentBalance).toFixed(2)}
                    </p>
                  )
                })()}
                <p className="text-sm text-muted-foreground">
                  {(Number(balance?.membershipBalance?.currentBalance ?? 0)) < 0 ? 'Outstanding balance' : 'Credit balance'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Status */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-primary/10 p-3 rounded-lg">
                <IconUser className="size-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Payment Status</h2>
            </div>
            {loading ? (
              <>
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-4 w-32" />
              </>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const statusRaw = paymentStatus || balance?.membershipBalance?.status
                  const status = statusRaw ? String(statusRaw).toUpperCase() : 'UNKNOWN'
                  const isPaid = ['PAID', 'AHEAD', 'CURRENT'].includes(status)
                  return (
                    <p className={`text-lg font-semibold ${isPaid ? 'text-green-500' : 'text-red-500'}`}>
                      {status}
                    </p>
                  )
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Household Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-primary/10 p-3 rounded-lg">
                <IconUser className="size-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Household</h2>
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-bold">{memberData.household_members}</p>
              <p className="text-sm text-muted-foreground">
                {memberData.household_members === 1 ? 'Member' : 'Members'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Payments */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-3 rounded-lg">
                <IconCash className="size-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Recent Payments</h2>
            </div>
            <Link href={`/members/${memberData.id}`} className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="py-2">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          ) : recentTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent payments</p>
          ) : (
            <>
              {recentTransactions.map((tx) => (
                <div key={tx.id} className="py-2 border-b border-border last:border-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{tx.description || 'Payment'}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.transaction_date)}</p>
                    </div>
                    {tx.transaction_type === 'credit' ? (
                      <span className="text-green-500">+${Math.abs(Number(tx.amount) || 0).toFixed(2)}</span>
                    ) : (
                      <span className="text-red-500">-${Math.abs(Number(tx.amount) || 0).toFixed(2)}</span>
                    )}
                  </div>
                </div>
              ))}
              <Link 
                href={`/members/${memberData.id}`}
                className="flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <span>View full history</span>
                <IconArrowRight className="size-3" />
              </Link>
            </>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Events */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-3 rounded-lg">
                <IconCalendarEvent className="size-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">{t("upcomingEvents")}</h2>
            </div>
            <Link href="/events" className="text-sm text-primary hover:underline">
              {t("viewAll")}
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="py-2">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
            </div>
          ) : upcomingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noUpcomingEvents")}</p>
          ) : (
            upcomingEvents.slice(0, 5).map((event) => (
              <Link href={`/events/${event.id}`} key={event.id} className="block py-2 border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{event.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-muted-foreground">{formatDate(event.event_date)}</p>
                      {event.start_time && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <p className="text-xs text-muted-foreground">{formatTime(event.start_time)}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      {/* Profile Link */}
      <Link href={`/members/${memberData.id}`} className="block p-4 border rounded-lg hover:bg-muted/50 transition-colors text-center">
        <p className="text-sm font-medium">View Full Profile</p>
        <p className="text-xs text-muted-foreground mt-1">See payment history, attended events, and more</p>
      </Link>
    </div>
  )
}

