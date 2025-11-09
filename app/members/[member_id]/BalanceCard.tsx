"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { IconCheck, IconX, IconAlertCircle, IconMinus } from '@tabler/icons-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { IconChevronDown } from '@tabler/icons-react'

type BalanceData = {
  currentBalance: number
  expectedPayments: number
  totalPaid: number
  monthlyFee: number
  monthlyBalances: Array<{
    month: string
    monthName: string
    startBalance: number
    endBalance: number
    payment: number
    expected: number
  }>
  status: 'caught_up' | 'ahead' | 'behind'
}

export default function BalanceCard({ memberId }: { memberId: number }) {
  const [balance, setBalance] = useState<BalanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openMonth, setOpenMonth] = useState<string | null>(null)

  useEffect(() => {
    fetchBalance()
  }, [memberId])

  async function fetchBalance() {
    try {
      const res = await fetch(`/api/membership/balance/${memberId}`)
      if (res.ok) {
        const data = await res.json()
        setBalance(data)
      } else {
        setError('Failed to load balance')
      }
    } catch (err) {
      setError('Error loading balance')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    )
  }

  if (error || !balance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">{error || 'No balance data available'}</p>
        </CardContent>
      </Card>
    )
  }

  const getStatusBadge = () => {
    if (balance.status === 'caught_up') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <IconCheck className="size-4 mr-1" />
          Caught Up
        </span>
      )
    } else if (balance.status === 'ahead') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          <IconCheck className="size-4 mr-1" />
          Ahead
        </span>
      )
    } else {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          <IconAlertCircle className="size-4 mr-1" />
          Behind
        </span>
      )
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Balance</CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className={`text-lg font-semibold ${
              balance.currentBalance === 0 
                ? 'text-green-600 dark:text-green-400' 
                : balance.currentBalance > 0 
                ? 'text-blue-600 dark:text-blue-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {formatCurrency(balance.currentBalance)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Expected Payments</p>
            <p className="text-lg font-semibold">{balance.expectedPayments}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Paid</p>
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">
              {formatCurrency(balance.totalPaid)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Monthly Fee</p>
            <p className="text-lg font-semibold">{formatCurrency(balance.monthlyFee)}</p>
          </div>
        </div>

        <Separator />

        {/* Monthly Breakdown */}
        <div>
          <p className="text-sm font-medium mb-3">Monthly Balance History</p>
          <div className="space-y-2">
            {balance.monthlyBalances.map((month) => (
              <Collapsible
                key={month.month}
                open={openMonth === month.month}
                onOpenChange={(open) => setOpenMonth(open ? month.month : null)}
              >
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <IconChevronDown className={`size-4 transition-transform ${openMonth === month.month ? 'rotate-180' : ''}`} />
                      <span className="font-medium">{month.monthName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-medium ${
                        month.endBalance === 0 
                          ? 'text-green-600 dark:text-green-400' 
                          : month.endBalance < 0 
                          ? 'text-red-600 dark:text-red-400' 
                          : 'text-blue-600 dark:text-blue-400'
                      }`}>
                        {formatCurrency(month.endBalance)}
                      </span>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 p-4 bg-muted/30 rounded-md space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Start Balance:</span>
                      <span className="font-medium">{formatCurrency(month.startBalance)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Expected:</span>
                      <span className="font-medium">-{formatCurrency(month.expected)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Paid:</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        +{formatCurrency(month.payment)}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm font-semibold">
                      <span>End Balance:</span>
                      <span className={
                        month.endBalance === 0 
                          ? 'text-green-600 dark:text-green-400' 
                          : month.endBalance < 0 
                          ? 'text-red-600 dark:text-red-400' 
                          : 'text-blue-600 dark:text-blue-400'
                      }>
                        {formatCurrency(month.endBalance)}
                      </span>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

