"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
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
  statement_id?: string | null
  statement_file_name?: string | null
  statement_date_from?: string | null
  statement_date_to?: string | null
}

type Member = {
  id: string
  name: string
  email: string
  phone: string
  member_id?: string
  banking_name?: string
}

export default function FinanceClient({ 
  account, 
  allAccounts
}: { 
  account: Account
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
  const [newAccountBSB, setNewAccountBSB] = useState('')
  const [newAccountIsDonation, setNewAccountIsDonation] = useState(false)
  
  // Current account data
  const currentAccount = accounts.find(a => a.id === selectedAccountId) || account
  const [balance, setBalance] = useState(currentAccount.current_balance)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(balance.toString())
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [showReasonDialog, setShowReasonDialog] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingTransactions, setLoadingTransactions] = useState(true)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [showTransactionDialog, setShowTransactionDialog] = useState(false)
  
  // Month pagination
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())
  
  // Add Transaction Dialog
  const [showAddTransactionDialog, setShowAddTransactionDialog] = useState(false)
  const [showAdvancePaymentDialog, setShowAdvancePaymentDialog] = useState(false)
  const [newTransactionDate, setNewTransactionDate] = useState(new Date().toISOString().split('T')[0])
  const [newTransactionName, setNewTransactionName] = useState('')
  const [newTransactionDescription, setNewTransactionDescription] = useState('')
  const [newTransactionAmount, setNewTransactionAmount] = useState('')
  const [newTransactionType, setNewTransactionType] = useState<'credit' | 'debit'>('credit')
  const [newTransactionMemberId, setNewTransactionMemberId] = useState<string | null>(null)
  const [newTransactionMemberName, setNewTransactionMemberName] = useState<string>('')
  
  // Advance Payment
  const [advanceMonths, setAdvanceMonths] = useState<number>(1)
  const [advanceDescription, setAdvanceDescription] = useState('')
  const [advanceMemberId, setAdvanceMemberId] = useState<string | null>(null)
  const [advanceMemberName, setAdvanceMemberName] = useState<string>('')
  
  // Member Search for matching (in table)
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [memberSearchResults, setMemberSearchResults] = useState<Member[]>([])
  const [searchingMembers, setSearchingMembers] = useState(false)
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null)
  
  // Member Search for add transaction dialog
  const [addTxnMemberQuery, setAddTxnMemberQuery] = useState('')
  const [addTxnMemberResults, setAddTxnMemberResults] = useState<Member[]>([])
  const [addTxnSearching, setAddTxnSearching] = useState(false)
  
  // Member Search for advance payment dialog
  const [advanceMemberQuery, setAdvanceMemberQuery] = useState('')
  const [advanceMemberResults, setAdvanceMemberResults] = useState<Member[]>([])
  const [advanceSearching, setAdvanceSearching] = useState(false)
  const [allMembers, setAllMembers] = useState<Member[]>([])

  // Load all members when advance payment dialog opens
  useEffect(() => {
    if (showAdvancePaymentDialog && allMembers.length === 0) {
      const loadMembers = async () => {
        try {
          const res = await fetch('/api/members')
          if (res.ok) {
            const data = await res.json()
            setAllMembers(data.members || [])
            setAdvanceMemberResults(data.members || [])
          }
        } catch (err) {
          console.error('Failed to load members', err)
        }
      }
      loadMembers()
    }
  }, [showAdvancePaymentDialog, allMembers.length])

  // Filter members based on search query
  useEffect(() => {
    if (advanceMemberQuery.trim() === '') {
      setAdvanceMemberResults(allMembers)
    } else {
      const query = advanceMemberQuery.toLowerCase()
      const filtered = allMembers.filter(m => 
        m.name?.toLowerCase().includes(query) ||
        m.email?.toLowerCase().includes(query) ||
        m.phone?.toLowerCase().includes(query)
      )
      setAdvanceMemberResults(filtered)
    }
  }, [advanceMemberQuery, allMembers])
  
  // Test send messages
  const [sendingTestMessages, setSendingTestMessages] = useState(false)
  
  // Update balance when account changes
  useEffect(() => {
    setBalance(currentAccount.current_balance)
    setEditValue(currentAccount.current_balance.toString())
  }, [currentAccount])
  
  const loadTransactions = useCallback(async () => {
    if (!selectedAccountId) return
    
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
  }, [selectedAccountId, currentMonth])
  
  // Load transactions on mount and when account or month changes
  useEffect(() => {
    if (selectedAccountId) {
      loadTransactions()
    }
  }, [selectedAccountId, currentMonth, loadTransactions])
  
  const handleAddAccount = async () => {
    if (!newAccountName.trim() || !newAccountNumber.trim() || !newAccountBSB.trim()) {
      showToast('Please fill in all required fields', 'error')
      return
    }

    // Validate BSB format (XXX-XXX or XXXXXX)
    const cleanBSB = newAccountBSB.replace(/-/g, '')
    if (cleanBSB.length !== 6 || !/^\d{6}$/.test(cleanBSB)) {
      showToast('BSB must be 6 digits (format: XXX-XXX)', 'error')
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
          bsb: newAccountBSB,
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
        setNewAccountBSB('')
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
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('accountId', selectedAccountId || '')

      // Simple progress bar (no status messages)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev === null || prev >= 95) return prev
          return prev + 5
        })
      }, 100)
      
      const res = await fetch('/api/finance/upload-statement', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      const data = await res.json()

      if (res.ok) {
        showToast(`✅ Uploaded ${data.transactionsImported || 0} transactions successfully!`, 'success')
        
        // Clear upload state and hide progress
        setTimeout(() => {
          setUploadProgress(null)
          setLoading(false)
        }, 500)

        // Load transactions immediately
        loadTransactions()
      } else {
        setUploadProgress(null)
        setLoading(false)
        showToast(`Error: ${data.error}`, 'error')
      }
    } catch (err: any) {
      console.error('Failed to upload statement', err)
      setUploadProgress(null)
      setLoading(false)
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

  // Handle advance payment
  const handleAdvancePayment = async () => {
    if (!advanceMemberId || !advanceMonths || advanceMonths < 1) {
      showToast('Please select a member and enter months', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/finance/advance-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: advanceMemberId,
          months: advanceMonths,
          description: advanceDescription,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        showToast(`Success! ${data.months} month(s) paid in advance for ${data.memberName}. Expires: ${data.expiryDate}`, 'success')
        
        // Reset form
        setShowAdvancePaymentDialog(false)
        setAdvanceMonths(1)
        setAdvanceDescription('')
        setAdvanceMemberId(null)
        setAdvanceMemberName('')
        
        // Reload transactions to show if any were added to current month
        loadTransactions()
      } else {
        showToast(data.error || 'Failed to record advance payment', 'error')
      }
    } catch (err) {
      console.error('Failed to record advance payment', err)
      showToast('Failed to record advance payment. Please try again.', 'error')
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

  // Update transaction category
  const handleUpdateCategory = async (transactionId: string, category: string) => {
    try {
      const res = await fetch('/api/finance/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId,
          category,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        // Update transaction in list
        setTransactions(transactions.map(t => 
          t.id === transactionId ? data.transaction : t
        ))
        showToast('Category updated successfully', 'success')
      } else {
        showToast(data.error || 'Failed to update category', 'error')
      }
    } catch (err) {
      console.error('Failed to update category', err)
      showToast('Failed to update category', 'error')
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
      `🧪 TEST MODE: Send Payment Reminder\n\n` +
      `This will send a personalized payment reminder to YOUR test number.\n\n` +
      `What happens:\n` +
      `• Finds members who are behind on payments\n` +
      `• Sends message for 1 member (test) with amount owed\n` +
      `• Includes bank account details for payment\n` +
      `• Message goes to WHATSAPP_TEST_NUMBER (not actual member)\n` +
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={loading}>
                <IconPlus className="mr-2 size-4" />
                Add Transaction
                <IconChevronDown className="ml-2 size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setShowAddTransactionDialog(true)}>
                Regular Transaction
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowAdvancePaymentDialog(true)}>
                Advance Payment
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                  <th className="text-left py-3 px-2">Member</th>
                  <th className="text-left py-3 px-2">Category</th>
                  <th className="text-right py-3 px-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {loadingTransactions ? (
                  // Grey shimmers while loading
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="border-b">
                      <td className="py-3 px-2">
                        <div className="h-4 w-20 bg-muted animate-pulse rounded"></div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="h-4 w-32 bg-muted animate-pulse rounded"></div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="h-4 w-48 bg-muted animate-pulse rounded"></div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="h-6 w-24 bg-muted animate-pulse rounded-full"></div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="h-6 w-32 bg-muted animate-pulse rounded"></div>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto"></div>
                      </td>
                    </tr>
                  ))
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
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
                              {txn.matched_member_name || 'Unknown'}
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
                                      onSelect={() => {
                                        handleMatchMember(txn.id, member.id)
                                        setOpenPopoverId(null)
                                        setMemberSearchQuery('')
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
                      <td className="py-3 px-2" onClick={(e) => e.stopPropagation()}>
                        <Select 
                          value={txn.category || 'Special Payment'}
                          onValueChange={(value) => handleUpdateCategory(txn.id, value)}
                        >
                          <SelectTrigger className="w-[150px] h-8 text-xs bg-background text-foreground border-input">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent className="bg-background border-input">
                            <SelectItem value="Membership Payment" className="text-foreground cursor-pointer">Membership Payment</SelectItem>
                            <SelectItem value="Special Payment" className="text-foreground cursor-pointer">Special Payment</SelectItem>
                          </SelectContent>
                        </Select>
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
            <div>
              <Label htmlFor="bsb">BSB (6 digits) *</Label>
              <Input
                id="bsb"
                value={newAccountBSB}
                onChange={(e) => {
                  let value = e.target.value.replace(/\D/g, '')
                  if (value.length <= 6) {
                    // Format as XXX-XXX
                    if (value.length > 3) {
                      value = value.slice(0, 3) + '-' + value.slice(3)
                    }
                    setNewAccountBSB(value)
                  }
                }}
                placeholder="123-456"
                className="mt-1"
                maxLength={7}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Bank State Branch number (format: XXX-XXX)
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
                disabled={!newAccountName.trim() || newAccountNumber.length !== 14 || newAccountBSB.replace(/-/g, '').length !== 6 || loading}
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

      {/* Advance Payment Dialog */}
      <Dialog open={showAdvancePaymentDialog} onOpenChange={setShowAdvancePaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Advance Payment</DialogTitle>
            <DialogDescription>
              Record a member paying for multiple months in advance. This will create membership payment records for future months.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="advance-member">Member *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between mt-1"
                  >
                    {advanceMemberName || "Select member..."}
                    <IconSearch className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput 
                      placeholder="Search member..." 
                      value={advanceMemberQuery}
                      onValueChange={setAdvanceMemberQuery}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {advanceSearching ? 'Searching...' : 'No members found'}
                      </CommandEmpty>
                      <CommandGroup>
                        {advanceMemberResults.map((member) => (
                          <CommandItem
                            key={member.id}
                            onSelect={() => {
                              setAdvanceMemberId(member.id)
                              setAdvanceMemberName(member.name)
                              setAdvanceMemberQuery('')
                              setAdvanceMemberResults([])
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
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {advanceMemberName && (
                <p className="text-xs text-muted-foreground mt-1">
                  Selected: {advanceMemberName}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="advance-months">Number of Months *</Label>
              <Select value={advanceMonths.toString()} onValueChange={(value) => setAdvanceMonths(parseInt(value))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                    <SelectItem key={m} value={m.toString()}>
                      {m} {m === 1 ? 'month' : 'months'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Covers: {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} → {new Date(new Date().getFullYear(), new Date().getMonth() + advanceMonths, 0).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </p>
            </div>

            <div>
              <Label htmlFor="advance-description">Description (Optional)</Label>
              <Input
                id="advance-description"
                value={advanceDescription}
                onChange={(e) => setAdvanceDescription(e.target.value)}
                placeholder="e.g., Annual membership paid in full"
                className="mt-1"
              />
            </div>

            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm font-medium">Payment Summary</p>
              <p className="text-xs text-muted-foreground mt-1">
                {advanceMonths} month(s) × $40.00 = ${(advanceMonths * 40).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                Valid until: {new Date(new Date().getFullYear(), new Date().getMonth() + advanceMonths, 0).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAdvancePaymentDialog(false)
                  setAdvanceMonths(1)
                  setAdvanceDescription('')
                  setAdvanceMemberId(null)
                  setAdvanceMemberName('')
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAdvancePayment} 
                disabled={!advanceMemberId || advanceMonths < 1 || loading}
              >
                {loading ? 'Recording...' : 'Record Payment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

