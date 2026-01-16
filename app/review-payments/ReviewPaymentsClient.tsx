"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { IconAlertCircle, IconCheck, IconArrowUp, IconChecks, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
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

const ITEMS_PER_PAGE = 20

export default function ReviewPaymentsClient() {
  const [allPayments, setAllPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set())
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  // Calculate paginated payments
  const totalPages = Math.ceil(allPayments.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const payments = allPayments.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  useEffect(() => {
    loadPayments()
  }, [])

  const loadPayments = async () => {
    try {
      const res = await fetch('/api/finance/review-payments?limit=1000')
      if (res.ok) {
        const data = await res.json()
        setAllPayments(data.payments || [])
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
      const res = await fetch('/api/finance/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: [paymentId],
          action: 'mark_as_membership',
        }),
      })

      if (res.ok) {
        showToast('✅ Reclassified as Membership Payment', 'success')
        // Remove from list
        setAllPayments(prev => prev.filter(p => p.id !== paymentId))
        setSelectedPayments(prev => {
          const next = new Set(prev)
          next.delete(paymentId)
          return next
        })
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
      const res = await fetch('/api/finance/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: [paymentId],
          action: 'mark_as_special',
        }),
      })

      if (res.ok) {
        showToast('✅ Confirmed as Special Payment', 'success')
        // Remove from list
        setAllPayments(prev => prev.filter(p => p.id !== paymentId))
        setSelectedPayments(prev => {
          const next = new Set(prev)
          next.delete(paymentId)
          return next
        })
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

  const toggleSelectAll = () => {
    const currentPageIds = payments.map(p => p.id)
    const allCurrentPageSelected = currentPageIds.every(id => selectedPayments.has(id))
    
    if (allCurrentPageSelected) {
      // Deselect all on current page
      setSelectedPayments(prev => {
        const next = new Set(prev)
        currentPageIds.forEach(id => next.delete(id))
        return next
      })
    } else {
      // Select all on current page
      setSelectedPayments(prev => {
        const next = new Set(prev)
        currentPageIds.forEach(id => next.add(id))
        return next
      })
    }
  }

  const selectAllPages = () => {
    setSelectedPayments(new Set(allPayments.map(p => p.id)))
  }

  const clearSelection = () => {
    setSelectedPayments(new Set())
  }

  const toggleSelectPayment = (paymentId: string) => {
    setSelectedPayments(prev => {
      const next = new Set(prev)
      if (next.has(paymentId)) {
        next.delete(paymentId)
      } else {
        next.add(paymentId)
      }
      return next
    })
  }

  const handleBulkMembership = async () => {
    if (selectedPayments.size === 0) return
    setBulkUpdating(true)
    
    try {
      const res = await fetch('/api/finance/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: Array.from(selectedPayments),
          action: 'mark_as_membership',
        }),
      })
      
      const data = await res.json()
      
      if (res.ok) {
        showToast(`✅ ${data.updatedCount} payment${data.updatedCount > 1 ? 's' : ''} reclassified as Membership`, 'success')
        setAllPayments(prev => prev.filter(p => !selectedPayments.has(p.id)))
        setSelectedPayments(new Set())
        // Reset to page 1 if current page would be empty
        if (currentPage > 1 && allPayments.length - selectedPayments.size <= (currentPage - 1) * ITEMS_PER_PAGE) {
          setCurrentPage(1)
        }
      } else {
        showToast(data.error || 'Failed to update payments', 'error')
      }
    } catch (err) {
      console.error('Bulk membership error:', err)
      showToast('Failed to update payments', 'error')
    }
    
    setBulkUpdating(false)
  }

  const handleBulkSpecial = async () => {
    if (selectedPayments.size === 0) return
    setBulkUpdating(true)
    
    try {
      const res = await fetch('/api/finance/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: Array.from(selectedPayments),
          action: 'mark_as_special',
        }),
      })
      
      const data = await res.json()
      
      if (res.ok) {
        showToast(`✅ ${data.updatedCount} payment${data.updatedCount > 1 ? 's' : ''} confirmed as Special`, 'success')
        setAllPayments(prev => prev.filter(p => !selectedPayments.has(p.id)))
        setSelectedPayments(new Set())
        // Reset to page 1 if current page would be empty
        if (currentPage > 1 && allPayments.length - selectedPayments.size <= (currentPage - 1) * ITEMS_PER_PAGE) {
          setCurrentPage(1)
        }
      } else {
        showToast(data.error || 'Failed to update payments', 'error')
      }
    } catch (err) {
      console.error('Bulk special error:', err)
      showToast('Failed to update payments', 'error')
    }
    
    setBulkUpdating(false)
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
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <IconAlertCircle className="size-5 text-yellow-500" />
                {loading ? '...' : allPayments.length} Payment{allPayments.length !== 1 ? 's' : ''} Need Review
              </h2>
              {totalPages > 1 && (
                <span className="text-sm text-muted-foreground">
                  (Page {currentPage} of {totalPages})
                </span>
              )}
            </div>
            {/* Bulk Actions */}
            {allPayments.length > 0 && selectedPayments.size > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">{selectedPayments.size} selected</span>
                {selectedPayments.size < allPayments.length && (
                  <Button onClick={selectAllPages} variant="ghost" size="sm" className="text-xs">
                    Select all {allPayments.length}
                  </Button>
                )}
                {selectedPayments.size > 0 && (
                  <Button onClick={clearSelection} variant="ghost" size="sm" className="text-xs">
                    Clear
                  </Button>
                )}
                <Button
                  onClick={handleBulkMembership}
                  disabled={bulkUpdating}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <IconChecks className="size-4 mr-1" />
                  {bulkUpdating ? 'Processing...' : 'Mark as Membership'}
                </Button>
                <Button
                  onClick={handleBulkSpecial}
                  disabled={bulkUpdating}
                  variant="outline"
                  size="sm"
                >
                  {bulkUpdating ? 'Processing...' : 'Keep Special'}
                </Button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 w-10">
                    <Checkbox
                      checked={payments.length > 0 && payments.every(p => selectedPayments.has(p.id))}
                      onCheckedChange={toggleSelectAll}
                      disabled={loading || payments.length === 0}
                    />
                  </th>
                  <th className="text-left py-3 px-2">Date</th>
                  <th className="text-left py-3 px-2">Name</th>
                  <th className="text-left py-3 px-2">Description</th>
                  <th className="text-left py-3 px-2">Member</th>
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
                        <Skeleton className="h-4 w-4" />
                      </td>
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
                    <tr 
                      key={payment.id} 
                      className={`border-b hover:bg-muted/50 transition-colors ${selectedPayments.has(payment.id) ? 'bg-primary/5' : ''}`}
                    >
                      <td className="py-3 px-2">
                        <Checkbox
                          checked={selectedPayments.has(payment.id)}
                          onCheckedChange={() => toggleSelectPayment(payment.id)}
                          disabled={updating === payment.id || bulkUpdating}
                        />
                      </td>
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
          
          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, allPayments.length)} of {allPayments.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <IconChevronLeft className="size-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <IconChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
