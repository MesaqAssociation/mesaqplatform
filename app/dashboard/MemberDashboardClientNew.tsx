"use client"

import { useState, useEffect } from 'react'
import { useI18n } from '@/components/I18nProvider'
import { IconCash, IconCalendarEvent, IconUser, IconArrowRight } from '@tabler/icons-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'

type MemberData = {
  id: string
  name: string
  member_id: string | null
  household_members: number
  date_joined: string
}

type Props = {
  initialData: MemberData
  isAdmin?: boolean
}

export default function MemberDashboardClient({ initialData, isAdmin = false }: Props) {
  const { t } = useI18n()
  const [memberData, setMemberData] = useState(initialData)
  const [balance, setBalance] = useState<{ membershipBalance: number; specialPaymentBalance: number } | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
  const [recentTransactions, setRecentTransactions] = useState<any[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([])
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
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

  const loadAll = async () => {
    try {
      // Load profile first for reliable memberId
      const profile = await fetch('/api/user/profile').then(r => r.ok ? r.json() : null)
      const memberId = profile?.id || memberData.id
      if (profile) {
        setMemberData({
          id: profile.id,
          name: profile.name || 'Member',
          member_id: profile.member_id || null,
          household_members: profile.household_members || 1,
          date_joined: profile.date_joined || new Date().toISOString()
        })
      }

      const [balanceRes, statusRes, txRes, eventsRes] = await Promise.all([
        fetch(`/api/membership/balance/${memberId}`),
        fetch(`/api/membership/status/${memberId}`),
        fetch(`/api/finance/transactions?memberId=${memberId}&limit=5`),
        fetch(`/api/events/list?limit=5&upcoming=true`),
      ])

      if (balanceRes.ok) {
        const balanceData = await balanceRes.json()
        console.log('Balance data:', balanceData)
        setBalance(balanceData)
      } else {
        console.error('Balance fetch failed:', balanceRes.status)
      }

      if (statusRes.ok) {
        const statusData = await statusRes.json()
        console.log('Status data:', statusData)
        setPaymentStatus(statusData.status)
      } else {
        console.error('Status fetch failed:', statusRes.status)
      }

      if (txRes.ok) {
        const txData = await txRes.json()
        console.log('Transactions data:', txData)
        setRecentTransactions(txData.transactions || [])
      } else {
        console.error('Transactions fetch failed:', txRes.status)
      }

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
                      {formatCurrency(currentBalance)}
                    </p>
                  )
                })()}
                <p className="text-sm text-muted-foreground">
                  {(Number(balance?.membershipBalance?.currentBalance ?? 0)) < 0 ? 'Outstanding balance' : 'Credit balance'}
                </p>
                {balance?.membershipBalance?.lastUpdated && (
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    As of {balance.membershipBalance.lastUpdated}
                  </p>
                )}
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
                  const status = statusRaw ? String(statusRaw).toLowerCase() : 'unknown'
                  const isCaughtUp = ['caught_up', 'paid', 'ahead', 'current'].includes(status)
                  const displayText = isCaughtUp ? 'Caught Up' : 'Behind'
                  return (
                    <p className={`text-lg font-semibold ${isCaughtUp ? 'text-green-500' : 'text-red-500'}`}>
                      {displayText}
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
            {isAdmin && (
              <Link href={`/members/${memberData.id}`} className="text-sm text-primary hover:underline">
                View all
              </Link>
            )}
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
                <div 
                  key={tx.id} 
                  className="py-2 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2 transition-colors"
                  onClick={() => setSelectedTransaction(tx)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{tx.description || 'Payment'}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.transaction_date)}</p>
                    </div>
                    {tx.transaction_type === 'credit' ? (
                      <span className="text-green-500">+{formatCurrency(Number(tx.amount) || 0)}</span>
                    ) : (
                      <span className="text-red-500">-{formatCurrency(Number(tx.amount) || 0)}</span>
                    )}
                  </div>
                </div>
              ))}
              {isAdmin && (
                <Link 
                  href={`/members/${memberData.id}`}
                  className="flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <span>View full history</span>
                  <IconArrowRight className="size-3" />
                </Link>
              )}
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

      {/* Profile Link - admins only */}
      {isAdmin && (
        <Link href={`/members/${memberData.id}`} className="block p-4 border rounded-lg hover:bg-muted/50 transition-colors text-center">
          <p className="text-sm font-medium">View Full Profile</p>
          <p className="text-xs text-muted-foreground mt-1">See payment history, attended events, and more</p>
        </Link>
      )}

      {/* Transaction Detail Dialog */}
      <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <p
                  className={`text-3xl font-bold ${
                    selectedTransaction.category === 'Charges'
                      ? 'text-foreground'
                      : selectedTransaction.transaction_type === 'credit'
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {selectedTransaction.category === 'Charges'
                    ? formatCurrency(Math.abs(Number(selectedTransaction.amount) || 0))
                    : (
                      <>
                        {selectedTransaction.transaction_type === 'credit' ? '+' : '-'}
                        {formatCurrency(Math.abs(Number(selectedTransaction.amount) || 0))}
                      </>
                    )}
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{formatDate(selectedTransaction.transaction_date)}</span>
                </div>
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Description</span>
                  <span className="font-medium text-right max-w-[60%]">
                    {selectedTransaction.description || selectedTransaction.transaction_name || 'Payment'}
                  </span>
                </div>
                
                {selectedTransaction.category && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Category</span>
                    <Badge variant="secondary">
                      {selectedTransaction.category}
                    </Badge>
                  </div>
                )}
                
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Type</span>
                  <span
                    className={`font-medium ${
                      selectedTransaction.category === 'Charges'
                        ? 'text-foreground'
                        : selectedTransaction.transaction_type === 'credit'
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {selectedTransaction.category === 'Charges'
                      ? 'Charge'
                      : selectedTransaction.transaction_type === 'credit'
                      ? 'Credit (Payment)'
                      : 'Debit'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

