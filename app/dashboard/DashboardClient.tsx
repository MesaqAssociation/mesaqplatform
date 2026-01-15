"use client"

import { useState, useEffect } from 'react'
import { useI18n } from '@/components/I18nProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { IconUsers, IconCash, IconCalendarEvent, IconArrowUp, IconArrowDown, IconArrowRight, IconAlertCircle, IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import Link from 'next/link'
import { showToast } from '@/lib/toast'
import { formatCurrency } from '@/lib/utils'

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
  member_id: string
  name: string
  current_balance: number
}

type StatementSummary = {
  account_id: string
  statement_date_from: string
  statement_date_to: string
  closing_balance: number
  total_credits: number
  total_debits: number
  credit_breakdown: Array<{ category: string; total: number }> | null
  debit_breakdown: Array<{ category: string; total: number }> | null
}

type Props = {
  memberStats: MemberStats
  recentTransactions: Transaction[]
  upcomingEvents: Event[]
  accounts: Account[]
  unpaidBalances: UnpaidBalance[]
  statementSummaries: StatementSummary[]
}

type ReviewPayment = {
  id: string
  transaction_date: string
  transaction_name: string
  description: string
  amount: number
  category: string
  matched_member_id: string
  member_name: string
  member_id: string
  account_name: string
}

type ReviewExpense = {
  id: string
  transaction_date: string
  transaction_name: string
  description: string
  amount: number
  category: string
  account_name: string
}

export default function DashboardClient({ memberStats, recentTransactions, upcomingEvents, accounts, unpaidBalances, statementSummaries }: Props) {
  const { t } = useI18n()
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(accounts[0]?.id || null)
  const [accountTransactions, setAccountTransactions] = useState<Transaction[]>([])
  const [reviewPayments, setReviewPayments] = useState<ReviewPayment[]>([])
  const [reviewExpenses, setReviewExpenses] = useState<ReviewExpense[]>([])
  const [loadingReviewPayments, setLoadingReviewPayments] = useState(true)
  const [selectedReviewPayment, setSelectedReviewPayment] = useState<ReviewPayment | null>(null)
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [updatingCategory, setUpdatingCategory] = useState(false)
  const [showDebitsBreakdown, setShowDebitsBreakdown] = useState(false)
  const [showCreditsBreakdown, setShowCreditsBreakdown] = useState(false)

  useEffect(() => {
    // Filter transactions by selected account and limit to 3
    if (selectedAccountId) {
      const filtered = recentTransactions.filter(tx => tx.account_id === selectedAccountId).slice(0, 3)
      setAccountTransactions(filtered)
    } else {
      setAccountTransactions(recentTransactions.slice(0, 3))
    }
  }, [selectedAccountId, recentTransactions])

  useEffect(() => {
    // Load payments and expenses needing review
    const loadReviewPayments = async () => {
      try {
        const res = await fetch('/api/finance/review-payments')
        if (res.ok) {
          const data = await res.json()
          setReviewPayments(data.payments || [])
          setReviewExpenses(data.expenses || [])
        }
      } catch (err) {
        console.error('Failed to load review payments:', err)
      } finally {
        setLoadingReviewPayments(false)
      }
    }
    loadReviewPayments()
  }, [])

  const handleUpdateCategory = async (newCategory: string) => {
    if (!selectedReviewPayment) return

    setUpdatingCategory(true)
    try {
      const res = await fetch('/api/finance/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedReviewPayment.id,
          category: newCategory,
        }),
      })

      if (res.ok) {
        showToast(`✅ Reclassified as ${newCategory}`, 'success')
        // Remove from review list
        setReviewPayments(prev => prev.filter(p => p.id !== selectedReviewPayment.id))
        setShowReviewDialog(false)
        setSelectedReviewPayment(null)
      } else {
        showToast('Failed to update category', 'error')
      }
    } catch (err) {
      console.error('Failed to update category:', err)
      showToast('Failed to update category', 'error')
    } finally {
      setUpdatingCategory(false)
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

        {/* Summary Card with Account Switcher */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-3 rounded-lg">
                <IconCash className="size-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Summary</h2>
            </div>
          </div>

          {/* Account Tabs */}
          {accounts.length > 0 && (
            <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => {
                    setSelectedAccountId(acc.id)
                    setShowDebitsBreakdown(false)
                    setShowCreditsBreakdown(false)
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                    selectedAccountId === acc.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {acc.account_name} {acc.account_number ? `(${acc.account_number.slice(-4)})` : ''}
                </button>
              ))}
            </div>
          )}

          {/* Statement Summary */}
          {(() => {
            const summary = statementSummaries.find(s => s.account_id === selectedAccountId)
            const account = accounts.find(a => a.id === selectedAccountId)
            
            if (!summary && account) {
              // No statement yet, show simple balance
              return (
                <div className="space-y-3">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
                    <p className="text-lg font-bold">{formatCurrency(account.current_balance)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">Upload a bank statement to see detailed summary</p>
                </div>
              )
            }
            
            if (!summary) return null
            
            const periodFrom = new Date(summary.statement_date_from)
            const periodTo = new Date(summary.statement_date_to)
            const periodLabel = `${periodFrom.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} - ${periodTo.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
            const openingBalance = Number(summary.closing_balance) - Number(summary.total_credits) + Number(summary.total_debits)
            
            return (
              <div className="space-y-3">
                {/* Period Header */}
                <div className="text-center py-2 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Statement Period</p>
                  <p className="text-sm font-semibold">{periodLabel}</p>
                </div>

                {/* Opening Balance */}
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted-foreground">Opening Balance</span>
                  <span className="text-sm font-semibold">{formatCurrency(openingBalance)}</span>
                </div>

                {/* Debits (expandable) - auto-open if $0 */}
                <div>
                  <button 
                    onClick={() => setShowDebitsBreakdown(!showDebitsBreakdown)}
                    className="flex justify-between items-center w-full py-2 hover:bg-muted/30 rounded transition-colors"
                  >
                    <span className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                      <IconArrowDown className="size-3" />
                      Debits
                    </span>
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
                      -{formatCurrency(summary.total_debits)}
                      {showDebitsBreakdown ? <IconChevronUp className="size-4" /> : <IconChevronDown className="size-4" />}
                    </span>
                  </button>
                  {showDebitsBreakdown && (
                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-red-200 pl-3">
                      {summary.debit_breakdown && summary.debit_breakdown.length > 0 ? (
                        summary.debit_breakdown.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{item.category || 'Uncategorized'}</span>
                            <span className="text-red-600 dark:text-red-400">{formatCurrency(item.total)}</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Cheques</span>
                          <span className="text-red-600 dark:text-red-400">{formatCurrency(0)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Credits (expandable) - auto-open if $0 */}
                <div>
                  <button 
                    onClick={() => setShowCreditsBreakdown(!showCreditsBreakdown)}
                    className="flex justify-between items-center w-full py-2 hover:bg-muted/30 rounded transition-colors"
                  >
                    <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                      <IconArrowUp className="size-3" />
                      Credits
                    </span>
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
                      +{formatCurrency(summary.total_credits)}
                      {showCreditsBreakdown ? <IconChevronUp className="size-4" /> : <IconChevronDown className="size-4" />}
                    </span>
                  </button>
                  {showCreditsBreakdown && (
                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-green-200 pl-3">
                      {summary.credit_breakdown && summary.credit_breakdown.length > 0 ? (
                        summary.credit_breakdown.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{item.category || 'Uncategorized'}</span>
                            <span className="text-green-600 dark:text-green-400">{formatCurrency(item.total)}</span>
                          </div>
                        ))
                      ) : (
                        <>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Membership Payment</span>
                            <span className="text-green-600 dark:text-green-400">{formatCurrency(0)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Special Payment</span>
                            <span className="text-green-600 dark:text-green-400">{formatCurrency(0)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Donation</span>
                            <span className="text-green-600 dark:text-green-400">{formatCurrency(0)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Closing Balance */}
                <div className="flex justify-between items-center py-2 border-t border-border">
                  <span className="text-sm font-medium">Closing Balance</span>
                  <span className="text-lg font-bold">{formatCurrency(summary.closing_balance)}</span>
                </div>

                <Link 
                  href="/finance" 
                  className="flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <span>View all transactions</span>
                  <IconArrowRight className="size-3" />
                </Link>
              </div>
            )
          })()}
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

      {/* NEED ACTION Section */}
      {loadingReviewPayments && (
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between py-3 px-4 border border-border rounded-lg">
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      )}

      {!loadingReviewPayments && (reviewPayments.length > 0 || reviewExpenses.length > 0) && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
            <IconAlertCircle className="size-5" />
            NEED ACTION
          </h2>
          
          {/* Review Payments Row */}
          {reviewPayments.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">
                    {reviewPayments.length} payment{reviewPayments.length !== 1 ? 's' : ''} need review
                  </span>
                </div>
                <Link 
                  href="/review-payments"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Review All Payments
                </Link>
              </div>
            </div>
          )}

          {/* Review Expenses Row */}
          {reviewExpenses.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">
                    {reviewExpenses.length} expense{reviewExpenses.length !== 1 ? 's' : ''} need categorization
                  </span>
                </div>
                <Link 
                  href="/finance"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Review Expenses
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Review Payment Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Payment</DialogTitle>
            <DialogDescription>
              Reclassify this payment if needed
            </DialogDescription>
          </DialogHeader>
          {selectedReviewPayment && (
            <div className="space-y-4">
              <div className="p-4 border border-border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Member</span>
                  <span className="text-sm font-medium">{selectedReviewPayment.member_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Date</span>
                  <span className="text-sm font-medium">{formatDate(selectedReviewPayment.transaction_date)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="text-sm font-bold text-green-500">+{formatCurrency(selectedReviewPayment.amount)}</span>
                </div>
                {selectedReviewPayment.description && (
                  <div className="pt-2 border-t border-border">
                    <span className="text-sm text-muted-foreground">Description:</span>
                    <p className="text-sm mt-1">{selectedReviewPayment.description}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Change Category</label>
                <Select 
                  defaultValue="Special Payment"
                  onValueChange={handleUpdateCategory}
                  disabled={updatingCategory}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Special Payment">Special Payment</SelectItem>
                    <SelectItem value="Membership Payment">Membership Payment</SelectItem>
                    <SelectItem value="Donation">Donation</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Only Membership Payment counts towards membership balance
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                href={`/members/${member.id}`}
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
                  {member.current_balance < 0 ? '-' : '+'}{formatCurrency(member.current_balance)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
