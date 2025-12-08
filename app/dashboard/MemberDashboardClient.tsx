"use client"

import { useI18n } from '@/components/I18nProvider'
import { IconCash, IconCalendarEvent, IconUser, IconArrowRight, IconAlertCircle } from '@tabler/icons-react'
import Link from 'next/link'

type MemberData = {
  id: string
  name: string
  current_balance: number
  member_id: string | null
  household_members: number
  date_joined: string
}

type Transaction = {
  id: number
  transaction_date: string
  transaction_name: string
  amount: number
  transaction_type: string
}

type Event = {
  id: number
  title: string
  event_date: string
  start_time: string
  event_type: 'meeting' | 'event'
}

type PaymentStatus = {
  payment_status: string
  total_paid: number
  monthly_fee: number
  payment_month: string
}

type Props = {
  memberData: MemberData
  recentTransactions: Transaction[]
  upcomingEvents: Event[]
  paymentStatus: PaymentStatus
}

export default function MemberDashboardClient({ memberData, recentTransactions, upcomingEvents, paymentStatus }: Props) {
  const { t } = useI18n()

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

  const getPaymentStatusColor = () => {
    if (!paymentStatus) return 'text-muted-foreground'
    const { total_paid, monthly_fee } = paymentStatus
    if (total_paid >= monthly_fee) return 'text-green-500'
    if (total_paid > 0) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getPaymentStatusText = () => {
    if (!paymentStatus) return 'No payment data'
    const { total_paid, monthly_fee, payment_month } = paymentStatus
    const monthName = new Date(payment_month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    
    if (total_paid >= monthly_fee) return `Paid for ${monthName}`
    if (total_paid > 0) return `Partial payment for ${monthName}`
    return `Unpaid for ${monthName}`
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome, {memberData.name}!</h1>
        {memberData.member_id && (
          <p className="text-muted-foreground">Member #{memberData.member_id}</p>
        )}
      </div>

      {/* Member Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Account Balance */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-primary/10 p-3 rounded-lg">
              <IconCash className="size-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Account Balance</h2>
          </div>
          <div className="space-y-2">
            <p className={`text-3xl font-bold ${memberData.current_balance < 0 ? 'text-red-500' : 'text-green-500'}`}>
              ${Math.abs(memberData.current_balance).toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground">
              {memberData.current_balance < 0 ? 'Outstanding balance' : 'Credit balance'}
            </p>
          </div>
        </div>

        {/* Payment Status */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-primary/10 p-3 rounded-lg">
              <IconAlertCircle className="size-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Payment Status</h2>
          </div>
          <div className="space-y-2">
            <p className={`text-lg font-semibold ${getPaymentStatusColor()}`}>
              {getPaymentStatusText()}
            </p>
            {paymentStatus && (
              <p className="text-sm text-muted-foreground">
                Paid: ${paymentStatus.total_paid.toFixed(2)} / ${paymentStatus.monthly_fee.toFixed(2)}
              </p>
            )}
          </div>
        </div>

        {/* Household Info */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-primary/10 p-3 rounded-lg">
              <IconUser className="size-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Household</h2>
          </div>
          <div className="space-y-2">
            <p className="text-3xl font-bold">{memberData.household_members || 1}</p>
            <p className="text-sm text-muted-foreground">
              {(memberData.household_members || 1) === 1 ? 'Member' : 'Members'}
            </p>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Recent Transactions */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Your Recent Payments</h2>
          </div>
          <div className="space-y-3">
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payment history</p>
            ) : (
              <>
                {recentTransactions.slice(0, 5).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.transaction_name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.transaction_date)}</p>
                    </div>
                    <div className="text-sm font-semibold ml-2">
                      {tx.transaction_type === 'credit' ? (
                        <span className="text-green-500">+${Math.abs(tx.amount).toFixed(2)}</span>
                      ) : (
                        <span className="text-red-500">-${Math.abs(tx.amount).toFixed(2)}</span>
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
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
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
          <div className="space-y-3">
            {upcomingEvents.length === 0 ? (
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
                    <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                      event.event_type === 'meeting' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {event.event_type === 'meeting' ? t("meetings") : t("events")}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Quick Links */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Quick Links</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href={`/members/${memberData.id}`} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors text-center">
            <IconUser className="size-6 mx-auto mb-2 text-primary" />
            <p className="text-sm font-medium">My Profile</p>
          </Link>
          <Link href="/events" className="p-4 border rounded-lg hover:bg-muted/50 transition-colors text-center">
            <IconCalendarEvent className="size-6 mx-auto mb-2 text-primary" />
            <p className="text-sm font-medium">Events</p>
          </Link>
          <Link href="/members" className="p-4 border rounded-lg hover:bg-muted/50 transition-colors text-center">
            <IconUser className="size-6 mx-auto mb-2 text-primary" />
            <p className="text-sm font-medium">Members</p>
          </Link>
          <Link href="/settings" className="p-4 border rounded-lg hover:bg-muted/50 transition-colors text-center">
            <IconCash className="size-6 mx-auto mb-2 text-primary" />
            <p className="text-sm font-medium">Settings</p>
          </Link>
        </div>
      </div>
    </div>
  )
}

