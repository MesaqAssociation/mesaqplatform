"use client"

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { IconEdit, IconCheck, IconX, IconUpload, IconDownload, IconArrowUp, IconArrowDown } from '@tabler/icons-react'

type Account = {
  id: string | null
  current_balance: number
  account_name?: string
}

type Transaction = {
  id: string
  transaction_date: string
  description: string
  amount: number
  transaction_type: string
  category: string | null
  reference: string | null
  balance_after: number | null
  creator_name: string | null
  created_at: string
}

export default function FinanceClient({ 
  account, 
  initialTransactions 
}: { 
  account: Account
  initialTransactions: Transaction[]
}) {
  const [balance, setBalance] = useState(account.current_balance)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(balance.toString())
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [showReasonDialog, setShowReasonDialog] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [loading, setLoading] = useState(false)

  const handleBalanceClick = () => {
    setIsEditing(true)
    setEditValue(balance.toString())
  }

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setEditValue(value)
    }
  }

  const handleBalanceSave = () => {
    if (editValue === balance.toString()) {
      setIsEditing(false)
      return
    }
    setShowReasonDialog(true)
  }

  const handleAdjustmentSubmit = async () => {
    if (!adjustmentReason.trim()) return

    setLoading(true)
    try {
      const newBalance = parseFloat(editValue) || 0
      const res = await fetch('/api/finance/adjust-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: account.id,
          newBalance,
          reason: adjustmentReason,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setBalance(newBalance)
        setTransactions([data.transaction, ...transactions])
        setIsEditing(false)
        setShowReasonDialog(false)
        setAdjustmentReason('')
      }
    } catch (err) {
      console.error('Failed to adjust balance', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('accountId', account.id || '')

      const res = await fetch('/api/finance/upload-statement', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (res.ok) {
        alert(`Success! ${data.message}\n\nTransactions imported: ${data.transactionsImported}/${data.totalFound}`)
        // Refresh page to show new transactions
        window.location.reload()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (err: any) {
      console.error('Failed to upload statement', err)
      alert('Failed to upload statement. Please try again.')
    } finally {
      setLoading(false)
      // Reset file input
      e.target.value = ''
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date + 'T00:00:00').toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      {/* Bank Balance */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Current Balance</p>
            {isEditing ? (
              <div className="flex items-center justify-center gap-2">
                <span className="text-5xl font-bold">$</span>
                <Input
                  type="text"
                  value={editValue}
                  onChange={handleBalanceChange}
                  className="text-5xl font-bold text-center max-w-md h-20 text-5xl"
                  autoFocus
                />
                <div className="flex flex-col gap-2">
                  <Button size="icon" onClick={handleBalanceSave} disabled={loading}>
                    <IconCheck className="size-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => setIsEditing(false)}>
                    <IconX className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div 
                onClick={handleBalanceClick}
                className="text-5xl font-bold cursor-pointer hover:opacity-70 transition-opacity inline-flex items-center gap-2"
              >
                {formatCurrency(balance)}
                <IconEdit className="size-6 text-muted-foreground" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upload Bank Statement */}
      <div className="flex justify-end">
        <label htmlFor="statement-upload">
          <Button asChild disabled={loading}>
            <span>
              <IconUpload className="mr-2 size-4" />
              Upload Bank Statement
            </span>
          </Button>
        </label>
        <input
          id="statement-upload"
          type="file"
          accept=".pdf,.csv,.xlsx,.xls"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Transactions Table */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold mb-4">Transactions</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">Date</th>
                  <th className="text-left py-3 px-2">Description</th>
                  <th className="text-left py-3 px-2">Category</th>
                  <th className="text-right py-3 px-2">Amount</th>
                  <th className="text-right py-3 px-2">Balance</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      No transactions yet
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn) => (
                    <tr key={txn.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-2">{formatDate(txn.transaction_date)}</td>
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium">{txn.description}</p>
                          {txn.reference && (
                            <p className="text-xs text-muted-foreground">Ref: {txn.reference}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">{txn.category || '-'}</td>
                      <td className={`py-3 px-2 text-right font-medium ${
                        txn.transaction_type === 'credit' 
                          ? 'text-green-600 dark:text-green-400' 
                          : txn.transaction_type === 'debit'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-blue-600 dark:text-blue-400'
                      }`}>
                        <div className="flex items-center justify-end gap-1">
                          {txn.transaction_type === 'credit' && <IconArrowDown className="size-3" />}
                          {txn.transaction_type === 'debit' && <IconArrowUp className="size-3" />}
                          {formatCurrency(Math.abs(txn.amount))}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right text-muted-foreground">
                        {txn.balance_after !== null ? formatCurrency(txn.balance_after) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Adjustment Reason Dialog */}
      <Dialog open={showReasonDialog} onOpenChange={setShowReasonDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Balance Adjustment Reason</DialogTitle>
            <DialogDescription>
              Please provide a reason for adjusting the balance from {formatCurrency(balance)} to {formatCurrency(parseFloat(editValue) || 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="e.g., Correcting bank reconciliation error..."
                className="mt-1"
                rows={4}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowReasonDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAdjustmentSubmit} 
                disabled={!adjustmentReason.trim() || loading}
              >
                {loading ? 'Adjusting...' : 'Confirm Adjustment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

