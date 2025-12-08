"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { IconAlertCircle, IconCheck } from '@tabler/icons-react'
import { showToast } from '@/lib/toast'

type Payment = {
  id: string
  transaction_date: string
  transaction_name: string
  description: string
  amount: number
  member_name: string
  member_id: string
  account_name: string
}

export default function ReviewPaymentsClient() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    loadPayments()
  }, [])

  const loadPayments = async () => {
    try {
      const res = await fetch('/api/finance/review-payments')
      if (res.ok) {
        const data = await res.json()
        setPayments(data.payments || [])
      }
    } catch (err) {
      console.error('Failed to load payments:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleReclassify = async (paymentId: string) => {
    setUpdating(paymentId)
    try {
      const res = await fetch('/api/finance/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: paymentId,
          category: 'Membership Payment',
        }),
      })

      if (res.ok) {
        showToast('✅ Reclassified as Membership Payment', 'success')
        // Remove from list
        setPayments(prev => prev.filter(p => p.id !== paymentId))
      } else {
        showToast('Failed to reclassify payment', 'error')
      }
    } catch (err) {
      console.error('Failed to reclassify:', err)
      showToast('Failed to reclassify payment', 'error')
    } finally {
      setUpdating(null)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Review Payments</h1>
        <p className="text-muted-foreground">Special payments that may need to be reclassified as membership payments</p>
      </div>

      {loading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-10 w-32" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : payments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <IconAlertCircle className="size-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Payments to Review</h3>
            <p className="text-muted-foreground">All special payments have been reviewed</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconAlertCircle className="size-5 text-yellow-500" />
              {payments.length} Payment{payments.length !== 1 ? 's' : ''} Need Review
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {payments.map((payment) => (
              <div 
                key={payment.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold">{payment.member_name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                      Special Payment
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(payment.transaction_date)} • {payment.transaction_name}
                  </p>
                  {payment.description && (
                    <p className="text-xs text-muted-foreground mt-1 truncate max-w-2xl">
                      {payment.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Account: {payment.account_name}
                  </p>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-500">
                      +${Math.abs(payment.amount).toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleReclassify(payment.id)}
                    disabled={updating === payment.id}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <IconCheck className="size-4" />
                    {updating === payment.id ? 'Updating...' : 'Mark as Membership'}
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

