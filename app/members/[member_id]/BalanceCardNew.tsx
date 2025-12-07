"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { IconCheck, IconX, IconAlertCircle, IconArrowRight } from '@tabler/icons-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { IconChevronDown } from '@tabler/icons-react'
import { showToast } from '@/lib/toast'

type BalanceData = {
  membershipBalance: {
    currentBalance: number
    expectedPayments: number
    totalPaid: number
    monthlyFee: number
    status: 'caught_up' | 'ahead' | 'behind'
  }
  specialPaymentBalance: {
    totalSpecialPayments: number
    transactions: Array<{
      id: string
      date: string
      name: string
      description: string
      amount: number
    }>
  }
}

export default function BalanceCard({ memberId }: { memberId: string }) {
  const [balance, setBalance] = useState<BalanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [convertingId, setConvertingId] = useState<string | null>(null)

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

  const handleConvertToMembership = async (transactionId: string) => {
    if (!confirm('Convert this special payment to a membership payment? This will count it toward their membership balance.')) {
      return
    }

    setConvertingId(transactionId)
    try {
      const res = await fetch('/api/finance/convert-to-membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, memberId }),
      })

      if (res.ok) {
        showToast('Payment converted to membership payment successfully', 'success')
        fetchBalance() // Reload balances
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to convert payment', 'error')
      }
    } catch (err) {
      console.error('Failed to convert payment:', err)
      showToast('Failed to convert payment', 'error')
    } finally {
      setConvertingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Membership Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
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
    if (balance.membershipBalance.status === 'caught_up') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <IconCheck className="size-4 mr-1" />
          Caught Up
        </span>
      )
    } else if (balance.membershipBalance.status === 'ahead') {
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="space-y-4">
      {/* Membership Balance Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Membership Balance</CardTitle>
            {getStatusBadge()}
          </div>
          <p className="text-sm text-muted-foreground">
            Only includes membership payments (exactly ${balance.membershipBalance.monthlyFee.toFixed(2)} or multiples)
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className={`text-lg font-semibold ${
                balance.membershipBalance.currentBalance === 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : balance.membershipBalance.currentBalance > 0 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(balance.membershipBalance.currentBalance)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Expected Payments</p>
              <p className="text-lg font-semibold">{balance.membershipBalance.expectedPayments}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Paid</p>
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(balance.membershipBalance.totalPaid)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Monthly Fee</p>
              <p className="text-lg font-semibold">{formatCurrency(balance.membershipBalance.monthlyFee)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Special Payments Balance Card */}
      {balance.specialPaymentBalance.totalSpecialPayments !== 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Special Payments Balance</span>
              <span className={`text-lg ${
                balance.specialPaymentBalance.totalSpecialPayments > 0 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(balance.specialPaymentBalance.totalSpecialPayments)}
              </span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Payments not counted toward membership fees (events, meals, donations, etc.)
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {balance.specialPaymentBalance.transactions.map((txn) => (
                <div key={txn.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{txn.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(txn.date)}</p>
                    {txn.description && (
                      <p className="text-xs text-muted-foreground truncate mt-1">{txn.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span className={`font-semibold ${
                      txn.amount > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(txn.amount)}
                    </span>
                    {txn.amount > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleConvertToMembership(txn.id)}
                        disabled={convertingId === txn.id}
                        className="text-xs"
                      >
                        {convertingId === txn.id ? (
                          'Converting...'
                        ) : (
                          <>
                            <IconArrowRight className="size-3 mr-1" />
                            Convert
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

