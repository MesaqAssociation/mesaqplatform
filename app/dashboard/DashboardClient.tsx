"use client"

import { useI18n } from '@/components/I18nProvider'
import { IconUsers, IconCash, IconCalendarEvent, IconArrowUp, IconArrowDown } from '@tabler/icons-react'
import Link from 'next/link'

type Transaction = {
  id: number
  transaction_date: string
  description: string
  debit: string | null
  credit: string | null
  balance: string | null
}

type Event = {
  id: number
  title: string
  event_date: string
  start_time: string
  event_type: 'meeting' | 'event'
}

type Props = {
  totalMembers: number
  recentTransactions: Transaction[]
  upcomingEvents: Event[]
}

export default function DashboardClient({ totalMembers, recentTransactions, upcomingEvents }: Props) {
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

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">{t("dashboard")}</h1>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Total Members Card */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-3 rounded-lg">
                <IconUsers className="size-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">{t("totalMembers")}</h2>
            </div>
          </div>
          <div className="text-4xl font-bold text-primary">{totalMembers}</div>
        </div>

        {/* Recent Transactions Card */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-3 rounded-lg">
                <IconCash className="size-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">{t("recentTransactions")}</h2>
            </div>
            <Link href="/finance" className="text-sm text-primary hover:underline">
              {t("viewAll")}
            </Link>
          </div>
          <div className="space-y-3">
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noTransactions")}</p>
            ) : (
              recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {tx.debit ? (
                      <IconArrowDown className="size-4 text-red-500 flex-shrink-0" />
                    ) : (
                      <IconArrowUp className="size-4 text-green-500 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.transaction_date)}</p>
                    </div>
                  </div>
                  <div className="text-sm font-semibold ml-2 flex-shrink-0">
                    {tx.debit ? (
                      <span className="text-red-500">-${parseFloat(tx.debit).toFixed(2)}</span>
                    ) : tx.credit ? (
                      <span className="text-green-500">+${parseFloat(tx.credit).toFixed(2)}</span>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Events Card */}
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
              upcomingEvents.map((event) => (
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
    </div>
  )
}

