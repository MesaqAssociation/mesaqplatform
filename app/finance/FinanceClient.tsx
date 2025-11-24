"use client"

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Checkbox } from '@/components/ui/checkbox'
import { IconEdit, IconCheck, IconX, IconUpload, IconDownload, IconArrowUp, IconArrowDown, IconTrash, IconPlus, IconChevronLeft, IconChevronRight, IconSearch, IconChevronDown, IconGift, IconFileText } from '@tabler/icons-react'

type Account = {
  id: string | null
  current_balance: number
  account_name?: string
  account_number?: string
}

type Transaction = {
  id: string
  transaction_date: string
  transaction_name: string
  description: string
  category: string
  amount: number
  transaction_type: string
  reference: string | null
  balance_after: number | null
  creator_name: string | null
  created_at: string
  source?: string | null
  matched_member_id?: string | null
  matched_member_name?: string | null
}

type Member = {
  id: string
  name: string
  email: string
  phone: string
  member_id?: number
  banking_name?: string
}

export default function FinanceClient({ 
  account, 
  initialTransactions,
  allAccounts
}: { 
  account: Account
  initialTransactions: Transaction[]
  allAccounts: Account[]
}) {
  // Account management
  const [accounts, setAccounts] = useState<Account[]>(allAccounts)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(account.id)
  const [showAddAccountDialog, setShowAddAccountDialog] = useState(false)
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountNumber, setNewAccountNumber] = useState('')
  const [newAccountIsDonation, setNewAccountIsDonation] = useState(false)
  
  // Current account data
  const currentAccount = accounts.find(a => a.id === selectedAccountId) || account
  const [balance, setBalance] = useState(currentAccount.current_balance)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(balance.toString())
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [showReasonDialog, setShowReasonDialog] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [loading, setLoading] = useState(false)
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [showTransactionDialog, setShowTransactionDialog] = useState(false)
  
  // Month pagination
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())
  
  // Add Transaction Dialog
  const [showAddTransactionDialog, setShowAddTransactionDialog] = useState(false)
  const [newTransactionDate, setNewTransactionDate] = useState(new Date().toISOString().split('T')[0])
  const [newTransactionName, setNewTransactionName] = useState('')
  const [newTransactionDescription, setNewTransactionDescription] = useState('')
  const [newTransactionAmount, setNewTransactionAmount] = useState('')
  const [newTransactionType, setNewTransactionType] = useState<'credit' | 'debit'>('credit')
  const [newTransactionMemberId, setNewTransactionMemberId] = useState<string | null>(null)
  const [newTransactionMemberName, setNewTransactionMemberName] = useState<string>('')
  
  // Member Search for matching (in table)
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [memberSearchResults, setMemberSearchResults] = useState<Member[]>([])
  const [searchingMembers, setSearchingMembers] = useState(false)
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null)
  
  // Member Search for add transaction dialog
  const [addTxnMemberQuery, setAddTxnMemberQuery] = useState('')
  const [addTxnMemberResults, setAddTxnMemberResults] = useState<Member[]>([])
  const [addTxnSearching, setAddTxnSearching] = useState(false)
  
  // Test send messages
  const [sendingTestMessages, setSendingTestMessages] = useState(false)
  
  // Update balance when account changes
  useEffect(() => {
    setBalance(currentAccount.current_balance)
    setEditValue(currentAccount.current_balance.toString())
  }, [currentAccount])
  
  // Load transactions when account or month changes
  useEffect(() => {
    if (selectedAccountId) {
      loadTransactions()
    }
  }, [selectedAccountId, currentMonth])
  
  const loadTransactions = async () => {
    setLoadingTransactions(true)
    try {
      const year = currentMonth.getFullYear()
      const month = currentMonth.getMonth() + 1
      const res = await fetch(`/api/finance/transactions?accountId=${selectedAccountId}&year=${year}&month=${month}`)
      if (res.ok) {
        const data = await res.json()
        setTransactions(data.transactions)
        if (data.balance !== undefined) {
          setBalance(data.balance)
        }
      }
    } catch (err) {
      console.error('Failed to load transactions', err)
    } finally {
      setLoadingTransactions(false)
    }
  }
  
  const handleAddAccount = async () => {
    if (!newAccountName.trim() || !newAccountNumber.trim()) {
      showToast('Please fill in all fields', 'error')
      return
    }
    
    setLoading(true)
    try {
      const res = await fetch('/api/finance/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_name: newAccountName,
          account_number: newAccountNumber,
          is_donation_account: newAccountIsDonation,
        }),
      })
      
      const data = await res.json()
      
      if (res.ok) {
        showToast('Bank account added successfully!', 'success')
        setAccounts([...accounts, data.account])
        setShowAddAccountDialog(false)
        setNewAccountName('')
        setNewAccountNumber('')
        setNewAccountIsDonation(false)
      } else {
        showToast(data.error || 'Failed to add account', 'error')
      }
    } catch (err) {
      console.error('Failed to add account', err)
      showToast('Failed to add account. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }
  
  const handleMonthChange = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1)
      } else {
        newDate.setMonth(newDate.getMonth() + 1)
      }
      return newDate
    })
  }
  
  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
  }
  
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'confirm') {
      showToast('Please type "confirm" to delete', 'error')
      return
    }
    
    if (accounts.length <= 1) {
      showToast('Cannot delete the last account', 'error')
      return
    }
    
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/accounts?id=${selectedAccountId}`, {
        method: 'DELETE',
      })
      
      const data = await res.json()
      
      if (res.ok) {
        showToast('Bank account deleted successfully!', 'success')
        // Remove from accounts list
        const updatedAccounts = accounts.filter(a => a.id !== selectedAccountId)
        setAccounts(updatedAccounts)
        // Switch to first remaining account
        setSelectedAccountId(updatedAccounts[0].id)
        setShowDeleteAccountDialog(false)
        setDeleteConfirmText('')
      } else {
        showToast(data.error || 'Failed to delete account', 'error')
      }
    } catch (err) {
      console.error('Failed to delete account', err)
      showToast('Failed to delete account. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

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
          accountId: selectedAccountId,
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
    setUploadStatus('📄 Uploading PDF...')
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('accountId', selectedAccountId || '')

      // Simulate upload progress with detailed steps
      const progressSteps = [
        { progress: 10, status: '📤 Uploading file...' },
        { progress: 20, status: '📖 Reading PDF...' },
        { progress: 30, status: '🔍 Parsing transactions...' },
        { progress: 50, status: '💾 Saving to database...' },
        { progress: 70, status: '📱 Step 1: Matching phone numbers...' },
        { progress: 80, status: '🏦 Step 2: Matching banking names...' },
        { progress: 90, status: '🤖 Step 3: AI matching (if needed)...' },
      ]

      let currentStep = 0
      const progressInterval = setInterval(() => {
        if (currentStep < progressSteps.length) {
          setUploadProgress(progressSteps[currentStep].progress)
          setUploadStatus(progressSteps[currentStep].status)
          currentStep++
        }
      }, 800)
      
      const res = await fetch('/api/finance/upload-statement', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)
      setUploadStatus('✅ Complete!')

      const data = await res.json()

      if (res.ok) {
        setTimeout(() => {
          let message = `Success! ${data.message}<br><br>Transactions imported: ${data.transactionsImported}/${data.totalFound}`
          
          // Show skipped transactions
          if (data.skippedDetails && data.skippedDetails.length > 0) {
            message += `<br><br><strong style="color: #f59e0b;">⚠️ Skipped Transactions (${data.skippedDetails.length}):</strong>`
            data.skippedDetails.slice(0, 5).forEach((s: any) => {
              message += `<br>• <strong>${s.date}</strong> - ${s.name?.substring(0, 50) || 'No name'}`
              message += `<br>  <em style="color: #6b7280;">Reason: ${s.reason}</em>`
            })
            if (data.skippedDetails.length > 5) {
              message += `<br>• ... and ${data.skippedDetails.length - 5} more`
            }
          }
          
          // Show failed transactions
          if (data.failedDetails && data.failedDetails.length > 0) {
            message += `<br><br><strong style="color: #ef4444;">❌ Failed Transactions (${data.failedDetails.length}):</strong>`
            data.failedDetails.slice(0, 5).forEach((f: any) => {
              message += `<br>• <strong>${f.date}</strong> - ${f.name?.substring(0, 50) || 'Unknown'}`
              message += `<br>  <em style="color: #6b7280;">Error: ${f.error}</em>`
            })
            if (data.failedDetails.length > 5) {
              message += `<br>• ... and ${data.failedDetails.length - 5} more`
            }
          }
          
          showToast(message, data.failed > 0 || data.skipped > 0 ? 'error' : 'success')
          
          // Log detailed info to console for debugging
          console.log('=== Bank Statement Upload Results ===')
          console.log(`Total found: ${data.totalFound}`)
          console.log(`Imported: ${data.transactionsImported}`)
          console.log(`Skipped: ${data.skipped}`)
          console.log(`Failed: ${data.failed}`)
          
          if (data.skippedDetails && data.skippedDetails.length > 0) {
            console.log('\n📋 All Skipped Transactions:')
            data.skippedDetails.forEach((s: any, i: number) => {
              console.log(`${i + 1}. Date: ${s.date}`)
              console.log(`   Name: ${s.name}`)
              console.log(`   Description: ${s.description || '-'}`)
              console.log(`   Reason: ${s.reason}`)
              console.log('')
            })
          }
          
          if (data.failedDetails && data.failedDetails.length > 0) {
            console.log('\n❌ All Failed Transactions:')
            data.failedDetails.forEach((f: any, i: number) => {
              console.log(`${i + 1}. Date: ${f.date}`)
              console.log(`   Name: ${f.name}`)
              console.log(`   Description: ${f.description || '-'}`)
              console.log(`   Error: ${f.error}`)
              console.log('')
            })
          }
          
          // Reload transactions instead of page
          setTimeout(() => {
            loadTransactions()
          }, data.failed > 0 || data.skipped > 0 ? 8000 : 2000)
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
        body: JSON.stringify({ accountId: selectedAccountId }),
      })

      if (res.ok) {
        showToast('All transactions cleared successfully!', 'success')
        // Instead of reloading, just update state
        setTransactions([])
        setBalance(0)
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

  // Search members by name, email, or phone
  const searchMembers = async (query: string) => {
    if (!query.trim()) {
      setMemberSearchResults([])
      return
    }

    setSearchingMembers(true)
    try {
      const res = await fetch(`/api/members?search=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        setMemberSearchResults(data.members || [])
      }
    } catch (err) {
      console.error('Failed to search members', err)
    } finally {
      setSearchingMembers(false)
    }
  }

  // Handle member search input change with debounce (for table popover)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (memberSearchQuery) {
        searchMembers(memberSearchQuery)
      } else {
        setMemberSearchResults([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [memberSearchQuery])
  
  // Handle member search for add transaction dialog
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (addTxnMemberQuery.trim()) {
        setAddTxnSearching(true)
        try {
          const res = await fetch(`/api/members?search=${encodeURIComponent(addTxnMemberQuery)}`)
          if (res.ok) {
            const data = await res.json()
            setAddTxnMemberResults(data.members || [])
          }
        } catch (err) {
          console.error('Failed to search members', err)
        } finally {
          setAddTxnSearching(false)
        }
      } else {
        setAddTxnMemberResults([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [addTxnMemberQuery])

  // Add new transaction
  const handleAddTransaction = async () => {
    if (!newTransactionName.trim() || !newTransactionAmount.trim()) {
      showToast('Please fill in required fields', 'error')
      return
    }

    const amount = parseFloat(newTransactionAmount)
    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid amount', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/finance/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccountId,
          transactionDate: newTransactionDate,
          transactionName: newTransactionName,
          description: newTransactionDescription,
          amount,
          transactionType: newTransactionType,
          matchedMemberId: newTransactionMemberId,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        showToast('Transaction added successfully!', 'success')
        
        // Add transaction to list if it's in the current month
        const txnDate = new Date(newTransactionDate)
        const currentMonthYear = `${currentMonth.getFullYear()}-${(currentMonth.getMonth() + 1).toString().padStart(2, '0')}`
        const txnMonthYear = `${txnDate.getFullYear()}-${(txnDate.getMonth() + 1).toString().padStart(2, '0')}`
        
        if (currentMonthYear === txnMonthYear) {
          setTransactions([data.transaction, ...transactions])
        }
        
        // Update balance
        setBalance(data.transaction.balance_after)
        
        // Reset form
        setShowAddTransactionDialog(false)
        setNewTransactionDate(new Date().toISOString().split('T')[0])
        setNewTransactionName('')
        setNewTransactionDescription('')
        setNewTransactionAmount('')
        setNewTransactionType('credit')
        setNewTransactionMemberId(null)
        setNewTransactionMemberName('')
      } else {
        showToast(data.error || 'Failed to add transaction', 'error')
      }
    } catch (err) {
      console.error('Failed to add transaction', err)
      showToast('Failed to add transaction. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Match transaction to member
  const handleMatchMember = async (transactionId: string, memberId: string | null) => {
    setLoading(true)
    try {
      const res = await fetch('/api/finance/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId,
          memberId,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        showToast(memberId ? 'Transaction matched to member!' : 'Member match removed', 'success')
        
        // Update transaction in list
        setTransactions(transactions.map(t => 
          t.id === transactionId ? data.transaction : t
        ))
        
        // Close popover and clear search
        setOpenPopoverId(null)
        setMemberSearchQuery('')
        setMemberSearchResults([])
      } else {
        const errorMessage = data.details 
          ? `${data.error}: ${data.details}` 
          : data.error || 'Failed to match member'
        showToast(errorMessage, 'error')
        console.error('API Error:', data)
      }
    } catch (err) {
      console.error('Failed to match member', err)
      showToast('Failed to match member. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTransaction = async () => {
    if (!selectedTransaction) return

    const confirmDelete = window.confirm(
      `Are you sure you want to delete this transaction?\n\n` +
      `"${selectedTransaction.transaction_name}"\n` +
      `${formatCurrency(Math.abs(selectedTransaction.amount))}\n\n` +
      `This will also remove any associated member payment records.`
    )

    if (!confirmDelete) return

    setLoading(true)
    try {
      const res = await fetch(`/api/finance/transactions?id=${selectedTransaction.id}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (res.ok) {
        showToast('Transaction deleted successfully', 'success')
        // Remove from list
        setTransactions(prev => prev.filter(txn => txn.id !== selectedTransaction.id))
        // Update balance if provided
        if (data.newBalance !== undefined) {
          setBalance(data.newBalance)
        }
        setShowTransactionDialog(false)
        setSelectedTransaction(null)
      } else {
        showToast(data.error || 'Failed to delete transaction', 'error')
      }
    } catch (err) {
      console.error('Delete transaction error:', err)
      showToast('Failed to delete transaction', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleTestSendMessages = async () => {
    const confirm = window.confirm(
      `🧪 TEST MODE: Send Payment Status\n\n` +
      `This will send payment status for unpaid members to YOUR test number.\n\n` +
      `What happens:\n` +
      `• Checks who hasn't paid for last month\n` +
      `• ALL messages go to WHATSAPP_TEST_NUMBER\n` +
      `• Shows who would get messages in production\n` +
      `• NO real members messaged\n` +
      `• NO DATA stored\n\n` +
      `Continue?`
    )

    if (!confirm) return

    setSendingTestMessages(true)
    try {
      const res = await fetch('/api/payment-reminders/test-send', {
        method: 'POST',
      })

      const data = await res.json()

      if (res.ok) {
        const failedMsg = data.messagesFailed > 0 ? ` (${data.messagesFailed} failed)` : ''
        showToast(
          `🧪 Test: Sent ${data.messagesSent} message(s) to your test number${failedMsg}`,
          'success'
        )
        console.log('📊 Test results:', data)
        
        // Show detailed results in console
        if (data.results && data.results.length > 0) {
          console.table(data.results)
        }
      } else {
        const errorMsg = data.details ? `${data.error}: ${data.details}` : data.error
        showToast(errorMsg || 'Failed to send test messages', 'error')
        console.error('❌ Test error:', data)
        if (data.stack) {
          console.error('Stack trace:', data.stack)
        }
      }
    } catch (err) {
      console.error('Test send error:', err)
      showToast('Failed to send test messages. Check console for details.', 'error')
    } finally {
      setSendingTestMessages(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount)
  }

  const formatDate = (date: string) => {
    try {
      // Handle various date formats from database
      let dateObj: Date
      
      if (date.includes('T')) {
        // Already has time component
        dateObj = new Date(date)
      } else if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // YYYY-MM-DD format - add time to avoid timezone issues
        dateObj = new Date(date + 'T00:00:00')
      } else {
        // Try parsing as-is
        dateObj = new Date(date)
      }
      
      // Check if valid date
      if (isNaN(dateObj.getTime())) {
        console.error('Invalid date:', date)
        return 'Invalid Date'
      }
      
      return dateObj.toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    } catch (err) {
      console.error('Error formatting date:', date, err)
      return 'Invalid Date'
    }
  }

  return (
    <div className="space-y-6">
      {/* Account Tabs with Delete Button */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 flex-1">
          {accounts.map((acc) => (
            <button
              key={acc.id}
              onClick={() => setSelectedAccountId(acc.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                selectedAccountId === acc.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {acc.account_name}
              {acc.account_number && (
                <span className="ml-2 text-xs opacity-70">
                  •••{acc.account_number.slice(-4)}
                </span>
              )}
            </button>
          ))}
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowDeleteAccountDialog(true)}
          disabled={accounts.length <= 1}
        >
          <IconTrash className="mr-2 size-4" />
          Delete Account
        </Button>
      </div>

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

      {/* Month Pagination */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => handleMonthChange('prev')}
        >
          <IconChevronLeft className="size-4" />
        </Button>
        <div className="text-lg font-semibold min-w-[200px] text-center">
          {formatMonthYear(currentMonth)}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => handleMonthChange('next')}
          disabled={currentMonth >= new Date()}
        >
          <IconChevronRight className="size-4" />
        </Button>
      </div>

      {/* Upload Bank Statement */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button 
            variant="destructive" 
            onClick={handleClearAll} 
            disabled={loading || transactions.length === 0}
          >
            <IconTrash className="mr-2 size-4" />
            Clear All Transactions
          </Button>
        <Button
          variant="outline"
          onClick={handleTestSendMessages}
          disabled={sendingTestMessages}
          className="border-orange-500 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950"
        >
          {sendingTestMessages ? (
            <>
              <IconUpload className="mr-2 size-4 animate-pulse" />
              Sending...
            </>
          ) : (
            <>
              🧪 Test Payment Reminders
            </>
          )}
        </Button>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowAddTransactionDialog(true)}
            disabled={loading}
          >
            <IconPlus className="mr-2 size-4" />
            Add Transaction
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowAddAccountDialog(true)}
            disabled={loading}
          >
            <IconPlus className="mr-2 size-4" />
            Add Bank Account
          </Button>
          <label htmlFor="statement-upload">
            <Button asChild disabled={loading}>
              <span>
                <IconUpload className="mr-2 size-4" />
                {loading ? 'Uploading...' : 'Upload Bank Statement'}
              </span>
            </Button>
          </label>
        </div>
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
                  <th className="text-left py-3 px-2">Name</th>
                  <th className="text-left py-3 px-2">Description</th>
                  <th className="text-left py-3 px-2">Category</th>
                  <th className="text-right py-3 px-2">Amount</th>
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
                          <p className="font-medium">{txn.transaction_name}</p>
                          {txn.reference && (
                            <p className="text-xs text-muted-foreground">Ref: {txn.reference}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <p className="text-sm text-muted-foreground truncate max-w-xs">
                          {txn.description || '-'}
                        </p>
                      </td>
                      <td className="py-3 px-2" onClick={(e) => e.stopPropagation()}>
                        <Popover 
                          open={openPopoverId === txn.id} 
                          onOpenChange={(open) => {
                            if (open) {
                              setOpenPopoverId(txn.id)
                              setMemberSearchQuery('')
                              setMemberSearchResults([])
                            } else {
                              setOpenPopoverId(null)
                              setMemberSearchQuery('')
                              setMemberSearchResults([])
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <button
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors hover:opacity-70 cursor-pointer bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            >
                              {txn.matched_member_name || txn.category}
                              <IconChevronDown className="ml-1 size-3" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-0" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput 
                                placeholder="Search member by name, email, or phone..." 
                                value={memberSearchQuery}
                                onValueChange={setMemberSearchQuery}
                              />
                              <CommandList>
                                <CommandEmpty>
                                  {searchingMembers ? 'Searching...' : 'No members found'}
                                </CommandEmpty>
                                <CommandGroup>
                                  {memberSearchResults.map((member) => (
                                    <CommandItem
                                      key={member.id}
                                      onSelect={() => handleMatchMember(txn.id, member.id)}
                                      className="cursor-pointer"
                                    >
                                      <div className="flex flex-col">
                                        <span className="font-medium">{member.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {member.email} • {member.phone}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                                {txn.matched_member_id && (
                                  <CommandGroup>
                                    <CommandItem
                                      onSelect={() => handleMatchMember(txn.id, null)}
                                      className="cursor-pointer text-red-600"
                                    >
                                      <IconX className="mr-2 size-4" />
                                      Remove member match
                                    </CommandItem>
                                  </CommandGroup>
                                )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </td>
                      <td className={`py-3 px-2 text-right font-medium ${
                        txn.transaction_type === 'credit' 
                          ? 'text-green-600 dark:text-green-400' 
                          : txn.transaction_type === 'debit'
                          ? 'text-red-600 dark:text-red-400'
                          : txn.amount > 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        <div className="flex items-center justify-end gap-1">
                          {(txn.transaction_type === 'credit' || (txn.transaction_type === 'adjustment' && txn.amount > 0)) && <IconArrowUp className="size-3" />}
                          {(txn.transaction_type === 'debit' || (txn.transaction_type === 'adjustment' && txn.amount < 0)) && <IconArrowDown className="size-3" />}
                          {formatCurrency(Math.abs(txn.amount))}
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
              <div>
                <Label className="text-muted-foreground text-xs">Date</Label>
                <p className="font-medium">{formatDate(selectedTransaction.transaction_date)}</p>
              </div>

              <div>
                <Label className="text-muted-foreground text-xs">Name</Label>
                <p className="font-medium text-lg">{selectedTransaction.transaction_name}</p>
              </div>

              {selectedTransaction.description && (
                <div>
                  <Label className="text-muted-foreground text-xs">Description</Label>
                  <p className="font-medium">{selectedTransaction.description}</p>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground text-xs">Category</Label>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  selectedTransaction.category === 'Misc' 
                    ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' 
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                }`}>
                  {selectedTransaction.category}
                </span>
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

              <div>
                <Label className="text-muted-foreground text-xs">Balance After</Label>
                <p className="font-medium">
                  {selectedTransaction.balance_after !== null 
                    ? formatCurrency(selectedTransaction.balance_after) 
                    : 'N/A'}
                </p>
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

              {selectedTransaction.statement_file_name && (
                <div className="border-t pt-4">
                  <Label className="text-muted-foreground text-xs">Bank Statement</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <IconFileText className="size-4 text-blue-500" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{selectedTransaction.statement_file_name}</p>
                      {selectedTransaction.statement_date_from && selectedTransaction.statement_date_to && (
                        <p className="text-xs text-muted-foreground">
                          {formatDate(selectedTransaction.statement_date_from)} - {formatDate(selectedTransaction.statement_date_to)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4 border-t">
                <Button 
                  variant="destructive" 
                  onClick={handleDeleteTransaction}
                  disabled={loading}
                >
                  <IconTrash className="mr-2 size-4" />
                  Delete Transaction
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowTransactionDialog(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Account Dialog */}
      <Dialog open={showAddAccountDialog} onOpenChange={setShowAddAccountDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Bank Account</DialogTitle>
            <DialogDescription>
              Add a new bank account to track transactions separately
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="account-name">Account Name *</Label>
              <Input
                id="account-name"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="e.g., Main Account, Savings, Business"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="account-number">Account Number (14 digits) *</Label>
              <Input
                id="account-number"
                value={newAccountNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '')
                  if (value.length <= 14) {
                    setNewAccountNumber(value)
                  }
                }}
                placeholder="12345678901234"
                className="mt-1"
                maxLength={14}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {newAccountNumber.length}/14 digits
              </p>
            </div>
            <div className="flex items-center space-x-2 py-2">
              <Checkbox 
                id="donation-account"
                checked={newAccountIsDonation}
                onCheckedChange={(checked) => setNewAccountIsDonation(checked === true)}
              />
              <Label 
                htmlFor="donation-account" 
                className="text-sm font-normal cursor-pointer flex items-center gap-2"
              >
                <IconGift className="size-4" />
                This is a donation account (view only, no member matching)
              </Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAddAccountDialog(false)
                  setNewAccountName('')
                  setNewAccountNumber('')
                  setNewAccountIsDonation(false)
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddAccount} 
                disabled={!newAccountName.trim() || newAccountNumber.length !== 14 || loading}
              >
                {loading ? 'Adding...' : 'Add Account'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteAccountDialog} onOpenChange={setShowDeleteAccountDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bank Account</DialogTitle>
            <DialogDescription>
              This will permanently delete the account "{currentAccount.account_name}". This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="delete-confirm">Type "confirm" to delete</Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="confirm"
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowDeleteAccountDialog(false)
                  setDeleteConfirmText('')
                }}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleDeleteAccount} 
                disabled={deleteConfirmText !== 'confirm' || loading}
              >
                {loading ? 'Deleting...' : 'Delete Account'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Transaction Dialog */}
      <Dialog open={showAddTransactionDialog} onOpenChange={setShowAddTransactionDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
            <DialogDescription>
              Manually add a transaction to the account. This is useful for payments not in bank statements.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="txn-date">Date *</Label>
                <Input
                  id="txn-date"
                  type="date"
                  value={newTransactionDate}
                  onChange={(e) => setNewTransactionDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="txn-type">Type *</Label>
                <Select value={newTransactionType} onValueChange={(value: 'credit' | 'debit') => setNewTransactionType(value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Credit (Money In)</SelectItem>
                    <SelectItem value="debit">Debit (Money Out)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="txn-name">Transaction Name *</Label>
              <Input
                id="txn-name"
                value={newTransactionName}
                onChange={(e) => setNewTransactionName(e.target.value)}
                placeholder="e.g., Cash Payment from John"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="txn-description">Description</Label>
              <Textarea
                id="txn-description"
                value={newTransactionDescription}
                onChange={(e) => setNewTransactionDescription(e.target.value)}
                placeholder="Optional details about the transaction..."
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="txn-amount">Amount *</Label>
              <Input
                id="txn-amount"
                type="number"
                step="0.01"
                min="0"
                value={newTransactionAmount}
                onChange={(e) => setNewTransactionAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="txn-member">Match to Member (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between mt-1"
                  >
                    {newTransactionMemberName || "Select member..."}
                    <IconSearch className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput 
                      placeholder="Search member..." 
                      value={addTxnMemberQuery}
                      onValueChange={setAddTxnMemberQuery}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {addTxnSearching ? 'Searching...' : 'No members found'}
                      </CommandEmpty>
                      <CommandGroup>
                        {addTxnMemberResults.map((member) => (
                          <CommandItem
                            key={member.id}
                            onSelect={() => {
                              setNewTransactionMemberId(member.id)
                              setNewTransactionMemberName(member.name)
                              setAddTxnMemberQuery('')
                              setAddTxnMemberResults([])
                            }}
                            className="cursor-pointer"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{member.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {member.email} • {member.phone}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      {newTransactionMemberId && (
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => {
                              setNewTransactionMemberId(null)
                              setNewTransactionMemberName('')
                            }}
                            className="cursor-pointer text-red-600"
                          >
                            <IconX className="mr-2 size-4" />
                            Clear selection
                          </CommandItem>
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {newTransactionMemberName && (
                <p className="text-xs text-muted-foreground mt-1">
                  Selected: {newTransactionMemberName}
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAddTransactionDialog(false)
                  setNewTransactionDate(new Date().toISOString().split('T')[0])
                  setNewTransactionName('')
                  setNewTransactionDescription('')
                  setNewTransactionAmount('')
                  setNewTransactionType('credit')
                  setNewTransactionMemberId(null)
                  setNewTransactionMemberName('')
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddTransaction} 
                disabled={!newTransactionName.trim() || !newTransactionAmount.trim() || loading}
              >
                {loading ? 'Adding...' : 'Add Transaction'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

