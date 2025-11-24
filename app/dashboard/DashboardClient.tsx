"use client"

import { useState, useEffect } from 'react'
import { useI18n } from '@/components/I18nProvider'
import { IconUsers, IconCash, IconCalendarEvent, IconArrowUp, IconArrowDown, IconArrowRight, IconAlertCircle } from '@tabler/icons-react'
import Link from 'next/link'

type Transaction = {
  id: number
  transaction_date: string
  transaction_name: string
  description: string
  amount: number
  transaction_type: string
  account_id: string
}

type Event = {
  id: number
  title: string
  event_date: string
  start_time: string
  event_type: 'meeting' | 'event'
}

type Account = {
  id: string
  account_name: string
  account_number: string | null
  current_balance: number
}

type MemberStats = {
  families: number
  total_members: number
}

type UnpaidBalance = {
  id: string
  member_id: number
  name: string
  current_balance: number
}

type Props = {
  memberStats: MemberStats
  recentTransactions: Transaction[]
  upcomingEvents: Event[]
  accounts: Account[]
  unpaidBalances: UnpaidBalance[]
}

export default function DashboardClient({ memberStats, recentTransactions, upcomingEvents, accounts, unpaidBalances }: Props) {
  const { t } = useI18n()
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(accounts[0]?.id || null)
  const [accountTransactions, setAccountTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    // Filter transactions by selected account and limit to 3
    if (selectedAccountId) {
      const filtered = recentTransactions.filter(tx => tx.account_id === selectedAccountId).slice(0, 3)
      setAccountTransactions(filtered)
    } else {
      setAccountTransactions(recentTransactions.slice(0, 3))
    }
  }, [selectedAccountId, recentTransactions])

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

  // Calculate pie chart percentages (families vs total members)
  const familiesPercentage = memberStats.total_members > 0 
    ? Math.round((memberStats.families / memberStats.total_members) * 100)
    : 0
  const householdPercentage = 100 - familiesPercentage

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">{t("dashboard")}</h1>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Members Pie Chart Card */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-3 rounded-lg">
                <IconUsers className="size-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Members</h2>
            </div>
          </div>
          
          {/* Pie Chart */}
          <div className="flex items-center justify-center mb-4">
            <div className="relative size-40">
              <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                {/* Background circle */}
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  className="stroke-muted"
                  strokeWidth="3"
                />
                {/* Families segment (primary color) */}
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  className="stroke-primary"
                  strokeWidth="3"
                  strokeDasharray={`${familiesPercentage} ${householdPercentage}`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-primary"></div>
                <span>Families</span>
              </div>
              <span className="font-semibold">{memberStats.families}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-muted"></div>
                <span>Total Members</span>
              </div>
              <span className="font-semibold">{memberStats.total_members}</span>
            </div>
          </div>
        </div>

        {/* Recent Transactions Card with Account Switcher */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-3 rounded-lg">
                <IconCash className="size-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">{t("recentTransactions")}</h2>
            </div>
          </div>

          {/* Account Tabs */}
          {accounts.length > 0 && (
            <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => setSelectedAccountId(acc.id)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                    selectedAccountId === acc.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {acc.account_name}
                </button>
              ))}
            </div>
          )}

          {/* Current Balance */}
          {selectedAccountId && accounts.find(a => a.id === selectedAccountId) && (
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
              <p className="text-lg font-bold">
                ${accounts.find(a => a.id === selectedAccountId)!.current_balance.toLocaleString('en-AU', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {accountTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noTransactions")}</p>
            ) : (
              <>
                {accountTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {tx.transaction_type === 'debit' || tx.amount < 0 ? (
                        <IconArrowDown className="size-4 text-red-500 flex-shrink-0" />
                      ) : (
                        <IconArrowUp className="size-4 text-green-500 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{tx.transaction_name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(tx.transaction_date)}</p>
                      </div>
                    </div>
                    <div className="text-sm font-semibold ml-2 flex-shrink-0">
                      {tx.transaction_type === 'debit' || tx.amount < 0 ? (
                        <span className="text-red-500">-${Math.abs(tx.amount).toFixed(2)}</span>
                      ) : (
                        <span className="text-green-500">+${Math.abs(tx.amount).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                ))}
                <Link 
                  href="/finance" 
                  className="flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <span>See all</span>
                  <IconArrowRight className="size-3" />
                </Link>
              </>
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

      {/* Unpaid Balances Card - Full Width */}
      {unpaidBalances.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-orange-500/10 p-3 rounded-lg">
                <IconAlertCircle className="size-6 text-orange-500" />
              </div>
              <h2 className="text-lg font-semibold">Outstanding Balances</h2>
            </div>
            <Link href="/members" className="text-sm text-primary hover:underline">
              View All Members
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {unpaidBalances.map((member) => (
              <Link 
                href={`/members/${member.member_id}`}
                key={member.id}
                className="flex items-center justify-between py-3 px-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {member.current_balance < 0 ? 'Owes' : 'Credit'}
                  </p>
                </div>
                <div className={`text-sm font-bold ml-2 flex-shrink-0 ${
                  member.current_balance < 0 ? 'text-red-500' : 'text-green-500'
                }`}>
                  {member.current_balance < 0 ? '-' : '+'}${Math.abs(member.current_balance).toFixed(2)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
