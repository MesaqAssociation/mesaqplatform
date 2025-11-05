"use client"

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { IconEdit, IconCheck, IconX, IconUpload, IconDownload, IconArrowUp, IconArrowDown, IconTrash } from '@tabler/icons-react'

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
  source?: string | null
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
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [showTransactionDialog, setShowTransactionDialog] = useState(false)

  const handleBalanceClick = () => {
    setIsEditing(true)
    setEditValue(balance.toString())
  }

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Allow negative numbers, decimals, and empty string
    if (value === '' || value === '-' || /^-?\d*\.?\d{0,2}$/.test(value)) {
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

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const toastDiv = document.createElement('div')
    toastDiv.className = 'fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white animate-slideInRight z-50 max-w-md'
    toastDiv.style.backgroundColor = type === 'success' ? '#34b14e' : '#ef4444'
    toastDiv.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <span class="flex-1">${message}</span>
        <button class="text-white font-bold hover:opacity-70" onclick="this.parentElement.parentElement.remove()">✕</button>
      </div>
    `
    document.body.appendChild(toastDiv)
    setTimeout(() => {
      toastDiv.remove()
    }, 5000)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setUploadProgress(0)
    setUploadStatus('Uploading PDF...')
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('accountId', account.id || '')

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev === null) return 30
          if (prev < 90) return prev + 10
          return prev
        })
      }, 200)

      setUploadStatus('Adding transactions...')
      
      const res = await fetch('/api/finance/upload-statement', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)
      setUploadStatus('Complete!')

      const data = await res.json()

      if (res.ok) {
        setTimeout(() => {
          let message = `Success! ${data.message}<br><br>Transactions imported: ${data.transactionsImported}/${data.totalFound}`
          
          if (data.failedDetails && data.failedDetails.length > 0) {
            message += `<br><br><strong>Failed Transactions:</strong>`
            data.failedDetails.slice(0, 3).forEach((f: any) => {
              message += `<br>• ${f.description?.substring(0, 40) || 'Unknown'}: ${f.error}`
            })
            if (data.failedDetails.length > 3) {
              message += `<br>• ... and ${data.failedDetails.length - 3} more`
            }
          }
          
          showToast(message, data.failed > 0 ? 'error' : 'success')
          setTimeout(() => {
            window.location.reload()
          }, data.failed > 0 ? 5000 : 2000)
        }, 500)
      } else {
        setUploadProgress(null)
        setUploadStatus('')
        showToast(`Error: ${data.error}`, 'error')
      }
    } catch (err: any) {
      console.error('Failed to upload statement', err)
      setUploadProgress(null)
      setUploadStatus('')
      showToast('Failed to upload statement. Please try again.', 'error')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to delete ALL transactions? This cannot be undone!')) {
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/finance/clear-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: account.id }),
      })

      if (res.ok) {
        showToast('All transactions cleared successfully!', 'success')
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        const data = await res.json()
        showToast(`Error: ${data.error}`, 'error')
      }
    } catch (err) {
      console.error('Failed to clear transactions', err)
      showToast('Failed to clear transactions. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleTransactionClick = (txn: Transaction) => {
    setSelectedTransaction(txn)
    setShowTransactionDialog(true)
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
              <div className="flex items-center justify-center gap-3">
                <span className="text-5xl font-bold">$</span>
                <Input
                  type="text"
                  value={editValue}
                  onChange={handleBalanceChange}
                  className="text-5xl font-bold text-center w-[400px] h-20 px-4"
                  style={{ fontSize: '3rem', lineHeight: '1' }}
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
                className="text-5xl font-bold cursor-pointer hover:opacity-70 transition-opacity inline-flex items-center gap-3"
              >
                {formatCurrency(balance)}
                <IconEdit className="size-6 text-muted-foreground" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upload Progress */}
      {uploadProgress !== null && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{uploadStatus}</p>
                <p className="text-sm text-muted-foreground">{uploadProgress}%</p>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Bank Statement */}
      <div className="flex justify-between items-center">
        <Button 
          variant="destructive" 
          onClick={handleClearAll} 
          disabled={loading || transactions.length === 0}
        >
          <IconTrash className="mr-2 size-4" />
          Clear All Transactions
        </Button>
        <label htmlFor="statement-upload">
          <Button asChild disabled={loading}>
            <span>
              <IconUpload className="mr-2 size-4" />
              {loading ? 'Uploading...' : 'Upload Bank Statement'}
            </span>
          </Button>
        </label>
        <input
          id="statement-upload"
          type="file"
          accept=".pdf"
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
                    <tr 
                      key={txn.id} 
                      className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleTransactionClick(txn)}
                    >
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

      {/* Transaction Detail Dialog */}
      <Dialog open={showTransactionDialog} onOpenChange={setShowTransactionDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Transaction ID</Label>
                  <p className="font-mono text-sm">{selectedTransaction.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Date</Label>
                  <p className="font-medium">{formatDate(selectedTransaction.transaction_date)}</p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground text-xs">Description</Label>
                <p className="font-medium text-lg">{selectedTransaction.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Type</Label>
                  <p className={`font-semibold capitalize ${
                    selectedTransaction.transaction_type === 'credit' 
                      ? 'text-green-600 dark:text-green-400' 
                      : selectedTransaction.transaction_type === 'debit'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}>
                    {selectedTransaction.transaction_type}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Amount</Label>
                  <p className={`font-bold text-xl ${
                    selectedTransaction.transaction_type === 'credit' 
                      ? 'text-green-600 dark:text-green-400' 
                      : selectedTransaction.transaction_type === 'debit'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}>
                    {selectedTransaction.transaction_type === 'credit' ? '+' : '-'}
                    {formatCurrency(Math.abs(selectedTransaction.amount))}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Balance After</Label>
                  <p className="font-medium">
                    {selectedTransaction.balance_after !== null 
                      ? formatCurrency(selectedTransaction.balance_after) 
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Category</Label>
                  <p className="font-medium">{selectedTransaction.category || 'Uncategorized'}</p>
                </div>
              </div>

              {selectedTransaction.reference && (
                <div>
                  <Label className="text-muted-foreground text-xs">Reference</Label>
                  <p className="font-mono text-sm">{selectedTransaction.reference}</p>
                </div>
              )}

              {selectedTransaction.source && (
                <div>
                  <Label className="text-muted-foreground text-xs">Source</Label>
                  <p className="font-medium capitalize">{selectedTransaction.source.replace('_', ' ')}</p>
                </div>
              )}

              {selectedTransaction.creator_name && (
                <div>
                  <Label className="text-muted-foreground text-xs">Created By</Label>
                  <p className="font-medium">{selectedTransaction.creator_name}</p>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground text-xs">Created At</Label>
                <p className="text-sm">
                  {new Date(selectedTransaction.created_at).toLocaleString('en-AU', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                  })}
                </p>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={() => setShowTransactionDialog(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

