"use client"

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { IconChevronLeft, IconChevronRight, IconReceipt, IconCalendar } from '@tabler/icons-react'

type Transaction = {
  id: string
  transaction_date: string
  transaction_name: string
  description: string
  amount: number
  transaction_type: string
  category: string | null
  source: string | null
}

export default function PaymentsClient({ transactions }: { transactions: Transaction[] }) {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // Get all unique months from transactions
  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    // Add current month and previous 12 months
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
    }
    // Also add months from actual transactions
    transactions.forEach(tx => {
      const date = new Date(tx.transaction_date)
      if (!isNaN(date.getTime())) {
        months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
      }
    })
    return Array.from(months).sort().reverse()
  }, [transactions])

  // Filter transactions by selected month
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const date = new Date(tx.transaction_date)
      const txMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      return txMonth === selectedMonth
    })
  }, [transactions, selectedMonth])

  // Calculate monthly total
  const monthlyTotal = useMemo(() => {
    return filteredTransactions.reduce((total, tx) => {
      const amount = Math.abs(Number(tx.amount) || 0)
      return total + (tx.transaction_type === 'credit' ? amount : 0)
    }, 0)
  }, [filteredTransactions])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-AU', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    })
  }

  const formatMonthDisplay = (monthStr: string) => {
    const [year, month] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, 1)
    return date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const currentIndex = availableMonths.indexOf(selectedMonth)
    if (direction === 'prev' && currentIndex < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[currentIndex + 1])
    } else if (direction === 'next' && currentIndex > 0) {
      setSelectedMonth(availableMonths[currentIndex - 1])
    }
  }

  const getCategoryColor = (category: string | null) => {
    switch (category?.toLowerCase()) {
      case 'membership payment':
        return 'bg-blue-100 text-blue-800'
      case 'event payment':
        return 'bg-purple-100 text-purple-800'
      case 'donation':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">My Payments</h1>
        <p className="text-muted-foreground text-sm mt-1">View your payment history</p>
      </div>

      {/* Month Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateMonth('prev')}
              disabled={availableMonths.indexOf(selectedMonth) >= availableMonths.length - 1}
            >
              <IconChevronLeft className="size-4" />
            </Button>
            
            <div className="flex-1 max-w-xs">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue>{formatMonthDisplay(selectedMonth)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map(month => (
                    <SelectItem key={month} value={month}>
                      {formatMonthDisplay(month)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateMonth('next')}
              disabled={availableMonths.indexOf(selectedMonth) <= 0}
            >
              <IconChevronRight className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Payments This Month</p>
            <p className="text-2xl font-bold text-green-600">${monthlyTotal.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Transactions</p>
            <p className="text-2xl font-bold">{filteredTransactions.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <IconReceipt className="size-5" />
            Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8">
              <IconCalendar className="size-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No payments found for {formatMonthDisplay(selectedMonth)}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTransactions.map((tx) => (
                <div 
                  key={tx.id} 
                  onClick={() => setSelectedTransaction(tx)}
                  className="p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {tx.description || tx.transaction_name || 'Payment'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(tx.transaction_date)}
                        </span>
                        {tx.category && (
                          <Badge variant="secondary" className={`text-xs ${getCategoryColor(tx.category)}`}>
                            {tx.category}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${tx.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.transaction_type === 'credit' ? '+' : '-'}${Math.abs(Number(tx.amount) || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Detail Dialog */}
      <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <p
                  className={`text-3xl font-bold ${
                    selectedTransaction.category === 'Charges'
                      ? 'text-foreground'
                      : selectedTransaction.transaction_type === 'credit'
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {selectedTransaction.category === 'Charges'
                    ? `$${Math.abs(Number(selectedTransaction.amount) || 0).toFixed(2)}`
                    : `${selectedTransaction.transaction_type === 'credit' ? '+' : '-'}$${Math.abs(Number(selectedTransaction.amount) || 0).toFixed(2)}`}
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{formatDate(selectedTransaction.transaction_date)}</span>
                </div>
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Description</span>
                  <span className="font-medium text-right max-w-[60%]">
                    {selectedTransaction.description || selectedTransaction.transaction_name || 'Payment'}
                  </span>
                </div>
                
                {selectedTransaction.category && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Category</span>
                    <Badge variant="secondary" className={getCategoryColor(selectedTransaction.category)}>
                      {selectedTransaction.category}
                    </Badge>
                  </div>
                )}
                
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Source</span>
                  <span className="font-medium">{selectedTransaction.source || 'Bank Transfer'}</span>
                </div>
                
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Type</span>
                  <span
                    className={`font-medium ${
                      selectedTransaction.category === 'Charges'
                        ? 'text-foreground'
                        : selectedTransaction.transaction_type === 'credit'
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {selectedTransaction.category === 'Charges'
                      ? 'Charge'
                      : selectedTransaction.transaction_type === 'credit'
                      ? 'Credit (Payment)'
                      : 'Debit'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
