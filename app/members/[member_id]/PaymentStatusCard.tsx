"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { IconCheck, IconX, IconAlertCircle, IconCurrencyDollar } from '@tabler/icons-react'

type PaymentStatus = {
  member: {
    id: string
    member_id: number
    name: string
    banking_name: string | null
    date_joined: string
  }
  paymentSummary: {
    monthlyFee: number
    totalExpectedPayments: number
    paidPayments: number
    overduePayments: number
    totalOwed: number
    isUpToDate: boolean
    percentagePaid: number
  }
  monthlyStatus: Array<{
    month: string
    monthName: string
    paid: boolean
    amount: number
    paymentDate: string | null
    transactionDescription: string | null
    status: string
  }>
  unpaidMonths: string[]
}

export default function PaymentStatusCard({ memberId }: { memberId: number }) {
  const [status, setStatus] = useState<PaymentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPaymentStatus()
  }, [memberId])

  async function fetchPaymentStatus() {
    try {
      const res = await fetch(`/api/membership/status/${memberId}`)
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      } else {
        setError('Failed to load payment status')
      }
    } catch (err) {
      setError('Error loading payment status')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Membership Payment Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    )
  }

  if (error || !status || !status.paymentSummary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Membership Payment Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">{error || 'No payment data available'}</p>
        </CardContent>
      </Card>
    )
  }

  const { paymentSummary, monthlyStatus = [], unpaidMonths = [] } = status

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Membership Payment Status</CardTitle>
          {paymentSummary.isUpToDate ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <IconCheck className="size-4 mr-1" />
              Up to Date
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              <IconAlertCircle className="size-4 mr-1" />
              {paymentSummary.overduePayments} Month{paymentSummary.overduePayments !== 1 ? 's' : ''} Behind
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Monthly Fee</p>
            <p className="text-lg font-semibold">${paymentSummary.monthlyFee.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Paid</p>
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">
              {paymentSummary.paidPayments}/{paymentSummary.totalExpectedPayments}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Overdue</p>
            <p className="text-lg font-semibold text-red-600 dark:text-red-400">
              {paymentSummary.overduePayments}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Owed</p>
            <p className="text-lg font-semibold text-red-600 dark:text-red-400">
              ${paymentSummary.totalOwed.toFixed(2)}
            </p>
          </div>
        </div>

        <Separator />

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Payment Progress</span>
            <span className="font-medium">{paymentSummary.percentagePaid}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${paymentSummary.percentagePaid}%` }}
            />
          </div>
        </div>

        {/* Unpaid months list */}
        {unpaidMonths.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-2 text-red-600 dark:text-red-400">
                Unpaid Months ({unpaidMonths.length}):
              </p>
              <div className="space-y-1">
                {unpaidMonths.slice(0, 6).map(month => (
                  <div key={month} className="flex items-center gap-2 text-sm">
                    <IconX className="size-4 text-red-500" />
                    <span>{month}</span>
                  </div>
                ))}
                {unpaidMonths.length > 6 && (
                  <p className="text-sm text-muted-foreground ml-6">
                    ...and {unpaidMonths.length - 6} more
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* Recent payment history */}
        <Separator />
        <div>
          <p className="text-sm font-medium mb-3">Recent Payment History</p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {monthlyStatus.slice(0, 12).map(month => (
              <div 
                key={month.month} 
                className={`flex items-center justify-between p-2 rounded-md ${
                  month.paid 
                    ? 'bg-green-50 dark:bg-green-900/10' 
                    : month.status === 'overdue'
                    ? 'bg-red-50 dark:bg-red-900/10'
                    : 'bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  {month.paid ? (
                    <IconCheck className="size-4 text-green-600" />
                  ) : (
                    <IconX className="size-4 text-red-600" />
                  )}
                  <span className="text-sm font-medium">{month.monthName}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">${month.amount.toFixed(2)}</p>
                  {month.paid && month.paymentDate && (
                    <p className="text-xs text-muted-foreground">
                      Paid {new Date(month.paymentDate).toLocaleDateString('en-AU', { 
                        day: 'numeric', 
                        month: 'short' 
                      })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

