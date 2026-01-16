"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { IconAlertCircle, IconCheck, IconArrowUp } from '@tabler/icons-react'
import { showToast } from '@/lib/toast'

type Payment = {
  id: string
  transaction_date: string
  transaction_name: string
  description: string
  amount: number
  category: string
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
          transactionId: paymentId,
          category: 'Membership Payment',
        }),
      })

      if (res.ok) {
        showToast('✅ Reclassified as Membership Payment', 'success')
        // Remove from list
        setPayments(prev => prev.filter(p => p.id !== paymentId))
      } else {
        const data = await res.json()
        console.error('Reclassify error:', data)
        showToast(data.error || 'Failed to reclassify payment', 'error')
      }
    } catch (err) {
      console.error('Failed to reclassify:', err)
      showToast('Failed to reclassify payment', 'error')
    } finally {
      setUpdating(null)
    }
  }

  const handleMarkAsSpecial = async (paymentId: string) => {
    setUpdating(paymentId)
    try {
      const res = await fetch('/api/finance/review-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: paymentId,
        }),
      })

      if (res.ok) {
        showToast('✅ Confirmed as Special Payment', 'success')
        // Remove from list
        setPayments(prev => prev.filter(p => p.id !== paymentId))
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to confirm payment', 'error')
      }
    } catch (err) {
      console.error('Failed to confirm:', err)
      showToast('Failed to confirm payment', 'error')
    } finally {
      setUpdating(null)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      let dateObj: Date
      if (dateStr.includes('T')) {
        dateObj = new Date(dateStr)
      } else if (dateStr.includes('-')) {
        const [year, month, day] = dateStr.split('-').map(Number)
        dateObj = new Date(year, month - 1, day)
      } else {
        dateObj = new Date(dateStr)
      }
      return dateObj.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Review Payments</h1>
        <p className="text-muted-foreground">Special payments that may need to be reclassified as membership payments</p>
      </div>

      {/* Payments Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <IconAlertCircle className="size-5 text-yellow-500" />
                {loading ? '...' : payments.length} Payment{payments.length !== 1 ? 's' : ''} Need Review
              </h2>
            </div>
          </div>
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">Date</th>
                  <th className="text-left py-3 px-2">Name</th>
                  <th className="text-left py-3 px-2">Description</th>
                  <th className="text-left py-3 px-2">Member</th>
                  <th className="text-left py-3 px-2">Category</th>
                  <th className="text-right py-3 px-2">Amount</th>
                  <th className="text-center py-3 px-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  // Grey shimmers while loading
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="border-b">
                      <td className="py-3 px-2">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="py-3 px-2">
                        <Skeleton className="h-4 w-32" />
                      </td>
                      <td className="py-3 px-2">
                        <Skeleton className="h-4 w-48" />
                      </td>
                      <td className="py-3 px-2">
                        <Skeleton className="h-6 w-24 rounded-full" />
                      </td>
                      <td className="py-3 px-2">
                        <Skeleton className="h-6 w-28" />
                      </td>
                      <td className="py-3 px-2 text-right">
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </td>
                      <td className="py-3 px-2">
                        <Skeleton className="h-10 w-full" />
                      </td>
                    </tr>
                  ))
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <IconCheck className="size-12 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
                      <p className="text-muted-foreground">No special payments need review</p>
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr key={payment.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-2 whitespace-nowrap">
                        {formatDate(payment.transaction_date)}
                      </td>
                      <td className="py-3 px-2 font-medium max-w-[200px] truncate">
                        {payment.transaction_name}
                      </td>
                      <td className="py-3 px-2 text-muted-foreground max-w-[250px] truncate">
                        {payment.description || '-'}
                      </td>
                      <td className="py-3 px-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          {payment.member_name}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                          {payment.category || 'Special Payment'}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right font-medium text-green-600 dark:text-green-400">
                        <div className="flex items-center justify-end gap-1">
                          <IconArrowUp className="size-3" />
                          {formatCurrency(Math.abs(payment.amount))}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleReclassify(payment.id)}
                            disabled={updating === payment.id}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                            size="sm"
                          >
                            <IconCheck className="size-4 mr-1" />
                            {updating === payment.id ? '...' : 'Membership'}
                          </Button>
                          <Button
                            onClick={() => handleMarkAsSpecial(payment.id)}
                            disabled={updating === payment.id}
                            variant="outline"
                            size="sm"
                          >
                            {updating === payment.id ? '...' : 'Keep Special'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
