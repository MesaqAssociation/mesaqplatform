"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Checkbox } from '@/components/ui/checkbox'
import { IconEdit, IconCheck, IconX, IconUpload, IconDownload, IconArrowUp, IconArrowDown, IconTrash, IconPlus, IconChevronLeft, IconChevronRight, IconSearch, IconChevronDown, IconGift, IconFileText, IconStar, IconStarFilled, IconBuildingBank, IconSend } from '@tabler/icons-react'
import BankAccountSettings from './BankAccountSettings'

type Account = {
  id: string | null
  current_balance: number
  account_name?: string
  account_number?: string
  bsb?: string
  is_donation_account?: boolean
  is_main_membership_account?: boolean
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
  statement_file_url?: string | null
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
  allAccounts,
  monthlyFee = 40
}: { 
  account: Account
  allAccounts: Account[]
  monthlyFee?: number
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
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadingTransactions, setLoadingTransactions] = useState(true)
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
  const [newTransactionCategory, setNewTransactionCategory] = useState<'Membership Payment' | 'Special Payment' | 'Donation'>('Membership Payment')
  const [newTransactionMemberId, setNewTransactionMemberId] = useState<string | null>(null)
  const [newTransactionMemberName, setNewTransactionMemberName] = useState<string>('')
  
  // Charge Member Dialog (for adding expected payments)
  const [showChargeMemberDialog, setShowChargeMemberDialog] = useState(false)
  
  // Bank Account Settings Dialog
  const [showBankAccountDialog, setShowBankAccountDialog] = useState(false)
  
  // Payment Reminders Dialog
  const [showPaymentRemindersDialog, setShowPaymentRemindersDialog] = useState(false)
  const [remindersPreview, setRemindersPreview] = useState<{ id: string; name: string; balance: number; phone: string }[]>([])
  const [loadingRemindersPreview, setLoadingRemindersPreview] = useState(false)
  const [sendingReminders, setSendingReminders] = useState(false)
  
  const [chargeAmount, setChargeAmount] = useState('')
  const [chargeReason, setChargeReason] = useState('')
  const [chargeMemberId, setChargeMemberId] = useState<string | null>(null)
  const [chargeMemberName, setChargeMemberName] = useState('')
  const [chargeMemberQuery, setChargeMemberQuery] = useState('')
  const [chargeMemberResults, setChargeMemberResults] = useState<Member[]>([])
  const [chargingMember, setChargingMember] = useState(false)
  
  // Member Search for matching (in table)
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [memberSearchResults, setMemberSearchResults] = useState<Member[]>([])
  const [searchingMembers, setSearchingMembers] = useState(false)
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null)
  
  // Member Search for add transaction dialog
  const [addTxnMemberQuery, setAddTxnMemberQuery] = useState('')
  const [addTxnMemberResults, setAddTxnMemberResults] = useState<Member[]>([])
  const [addTxnSearching, setAddTxnSearching] = useState(false)
  const [addTxnPopoverOpen, setAddTxnPopoverOpen] = useState(false)
  const [chargeMemberPopoverOpen, setChargeMemberPopoverOpen] = useState(false)
  const [dialogMemberPopoverOpen, setDialogMemberPopoverOpen] = useState(false)
  const [allMembers, setAllMembers] = useState<Member[]>([])
  
  // Multi-select transactions for bulk delete
  const [selectMode, setSelectMode] = useState(false)
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set())
  const [deletingSelected, setDeletingSelected] = useState(false)

  // Load members when charge dialog opens
  useEffect(() => {
    if (showChargeMemberDialog && allMembers.length === 0) {
      const loadMembers = async () => {
        try {
          const res = await fetch('/api/members')
          if (res.ok) {
            const data = await res.json()
            setAllMembers(data.members || [])
            setChargeMemberResults(data.members || [])
          }
        } catch (err) {
          console.error('Failed to load members', err)
        }
      }
      loadMembers()
    } else if (showChargeMemberDialog) {
      setChargeMemberResults(allMembers)
    }
  }, [showChargeMemberDialog, allMembers])

  // Filter members for charge dialog
  useEffect(() => {
    if (chargeMemberQuery.trim() === '') {
      setChargeMemberResults(allMembers)
    } else {
      const query = chargeMemberQuery.toLowerCase()
      const filtered = allMembers.filter(m => 
        m.name?.toLowerCase().includes(query) ||
        m.email?.toLowerCase().includes(query) ||
        m.phone?.toLowerCase().includes(query)
      )
      setChargeMemberResults(filtered)
    }
  }, [chargeMemberQuery, allMembers])
  
  
  // Transaction Search
  const [showSearchBar, setShowSearchBar] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchType, setSearchType] = useState<'description' | 'amount' | 'name'>('description')
  const [searchResults, setSearchResults] = useState<Transaction[]>([])
  const [searching, setSearching] = useState(false)
  
  // Dialog edit states
  const [dialogCategory, setDialogCategory] = useState<string>('')
  const [dialogMemberId, setDialogMemberId] = useState<string | null>(null)
  const [dialogMemberSearchQuery, setDialogMemberSearchQuery] = useState('')
  const [dialogMemberResults, setDialogMemberResults] = useState<Member[]>([])
  const [savingDialog, setSavingDialog] = useState(false)
  
  // Update balance when account changes
  useEffect(() => {
    setBalance(currentAccount.current_balance)
    setEditValue(currentAccount.current_balance.toString())
  }, [currentAccount])
  
  // Ref to track the latest request and prevent race conditions
  const latestRequestRef = useRef<number>(0)
  
  const loadTransactions = useCallback(async () => {
    if (!selectedAccountId) return
    
    // Increment request counter to track the latest request
    const requestId = ++latestRequestRef.current
    
    setLoadingTransactions(true)
    try {
      const year = currentMonth.getFullYear()
      const month = currentMonth.getMonth() + 1
      const res = await fetch(`/api/finance/transactions?accountId=${selectedAccountId}&year=${year}&month=${month}`)
      
      // Only update state if this is still the latest request
      if (requestId !== latestRequestRef.current) {
        console.log('Ignoring stale response for month:', month)
        return
      }
      
      if (res.ok) {
        const data = await res.json()
        setTransactions(data.transactions)
        if (data.balance !== undefined) {
          setBalance(data.balance)
        }
      }
    } catch (err) {
      // Only log error if this is still the latest request
      if (requestId === latestRequestRef.current) {
      console.error('Failed to load transactions', err)
      }
    } finally {
      // Only set loading to false if this is still the latest request
      if (requestId === latestRequestRef.current) {
      setLoadingTransactions(false)
      }
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

  // Search transactions
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    
    setSearching(true)
    try {
      const res = await fetch(`/api/finance/transactions/search?accountId=${selectedAccountId}&type=${searchType}&query=${encodeURIComponent(searchQuery)}`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.transactions || [])
      }
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setSearching(false)
    }
  }
  
  // Debounced search - always active now that search bar is always visible
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, searchType, selectedAccountId])

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

    setUploading(true)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('accountId', selectedAccountId || '')

      // Use XMLHttpRequest for accurate progress tracking
      const xhr = new XMLHttpRequest()
      
      // Track upload progress
      // Progress tracking removed - using indeterminate animation instead

      // Handle completion
      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText)
              resolve({ ok: true, data })
            } catch (err) {
              reject(new Error('Failed to parse response'))
            }
          } else {
            try {
              const data = JSON.parse(xhr.responseText)
              resolve({ ok: false, data })
            } catch (err) {
              reject(new Error(xhr.statusText))
            }
          }
        })

        xhr.addEventListener('error', () => {
          reject(new Error('Network error occurred'))
        })

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'))
        })
      })

      xhr.open('POST', '/api/finance/upload-statement')
      xhr.send(formData)

      const result = await uploadPromise

      if (result.ok) {
        showToast(`✅ Uploaded ${result.data.transactionsImported || 0} transactions successfully!`, 'success')
        setUploading(false)
        // Load transactions immediately
        loadTransactions()
      } else {
        setUploading(false)
        showToast(`Error: ${result.data.error}`, 'error')
      }
    } catch (err: any) {
      console.error('Failed to upload statement', err)
      setUploading(false)
      showToast('Failed to upload statement. Please try again.', 'error')
    } finally {
      setUploading(false)
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
    // Normalize category to valid dropdown options
    let category = txn.category?.trim() || 'Special Payment'
    // Convert legacy 'Event Payment' to 'Special Payment'
    if (category === 'Event Payment') {
      category = 'Special Payment'
    }
    // Only allow valid categories
    if (!['Membership Payment', 'Special Payment', 'Donation', 'Charges'].includes(category)) {
      category = 'Special Payment'
    }
    setDialogCategory(category)
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

  // Handle member search for transaction detail dialog
  useEffect(() => {
    const timer = setTimeout(() => {
      if (dialogMemberSearchQuery) {
        searchMembers(dialogMemberSearchQuery)
      } else {
        setMemberSearchResults([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [dialogMemberSearchQuery])
  
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
          category: newTransactionCategory,
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
        setNewTransactionCategory('Membership Payment')
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

  // Charge member (add expected payment/reduce balance)
  const handleChargeMember = async () => {
    if (!chargeMemberId || !chargeAmount.trim() || !chargeReason.trim()) {
      showToast('Please select a member, enter amount and reason', 'error')
      return
    }

    const amount = parseFloat(chargeAmount)
    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid amount', 'error')
      return
    }

    setChargingMember(true)
    try {
      const res = await fetch('/api/finance/charge-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: chargeMemberId,
          amount,
          reason: chargeReason,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        showToast(`Charged $${amount.toFixed(2)} to ${chargeMemberName}`, 'success')
        
        // Reset form
        setShowChargeMemberDialog(false)
        setChargeAmount('')
        setChargeReason('')
        setChargeMemberId(null)
        setChargeMemberName('')
        setChargeMemberQuery('')
        
        // Reload transactions
        loadTransactions()
      } else {
        showToast(data.error || 'Failed to charge member', 'error')
      }
    } catch (err) {
      console.error('Failed to charge member', err)
      showToast('Failed to charge member. Please try again.', 'error')
    } finally {
      setChargingMember(false)
    }
  }

  // Load payment reminders preview
  const loadRemindersPreview = async () => {
    setLoadingRemindersPreview(true)
    try {
      const res = await fetch('/api/payment-reminders/send')
      if (res.ok) {
        const data = await res.json()
        setRemindersPreview(data.members || [])
      } else {
        showToast('Failed to load members with outstanding balance', 'error')
      }
    } catch (err) {
      console.error('Failed to load reminders preview', err)
      showToast('Failed to load preview', 'error')
    } finally {
      setLoadingRemindersPreview(false)
    }
  }

  // Send payment reminders to all members with negative balance
  const handleSendReminders = async () => {
    if (remindersPreview.length === 0) {
      showToast('No members to send reminders to', 'error')
      return
    }

    // Check balance first
    const cost = remindersPreview.length * 0.10
    try {
      const balanceRes = await fetch('/api/messaging/balance')
      if (balanceRes.ok) {
        const balanceData = await balanceRes.json()
        if (balanceData.balance < cost) {
          showToast(`Insufficient balance. Need $${cost.toFixed(2)} but only have $${balanceData.balance.toFixed(2)}`, 'error')
          return
        }
      }
    } catch (err) {
      console.error('Failed to check balance', err)
    }

    setSendingReminders(true)
    try {
      const res = await fetch('/api/payment-reminders/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testMode: false }),
      })

      const data = await res.json()

      if (res.ok) {
        showToast(`Payment reminders sent to ${data.sent} members`, 'success')
        setShowPaymentRemindersDialog(false)
      } else {
        showToast(data.error || 'Failed to send reminders', 'error')
      }
    } catch (err) {
      console.error('Failed to send reminders', err)
      showToast('Failed to send reminders. Please try again.', 'error')
    } finally {
      setSendingReminders(false)
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
        
        // Also update selectedTransaction if this is the one being viewed in the dialog
        if (selectedTransaction && selectedTransaction.id === transactionId) {
          setSelectedTransaction(data.transaction)
        }
        
        // Close popover and clear search
        setOpenPopoverId(null)
        setMemberSearchQuery('')
        setMemberSearchResults([])
        setDialogMemberSearchQuery('')
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

  // Handle bulk delete of selected transactions
  const handleDeleteSelectedTransactions = async () => {
    if (selectedTransactions.size === 0) return

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedTransactions.size} transaction${selectedTransactions.size > 1 ? 's' : ''}?\n\nThis will also remove any associated member payment records.`
    )

    if (!confirmDelete) return

    setDeletingSelected(true)
    let successCount = 0
    let failCount = 0

    for (const txnId of selectedTransactions) {
      try {
        const res = await fetch(`/api/finance/transactions?id=${txnId}`, {
          method: 'DELETE',
        })
        if (res.ok) {
          successCount++
        } else {
          failCount++
        }
      } catch {
        failCount++
      }
    }

    if (successCount > 0) {
      showToast(`Deleted ${successCount} transaction${successCount > 1 ? 's' : ''}`, 'success')
      // Reload transactions
      loadTransactions()
    }
    if (failCount > 0) {
      showToast(`Failed to delete ${failCount} transaction${failCount > 1 ? 's' : ''}`, 'error')
    }

    setSelectedTransactions(new Set())
    setSelectMode(false)
    setDeletingSelected(false)
  }

  // Toggle transaction selection
  const toggleTransactionSelection = (txnId: string) => {
    setSelectedTransactions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(txnId)) {
        newSet.delete(txnId)
      } else {
        newSet.add(txnId)
      }
      return newSet
    })
  }

  // Select all visible transactions
  const selectAllTransactions = () => {
    const allIds = new Set(transactions.map(t => t.id))
    setSelectedTransactions(allIds)
  }

  // Clear selection
  const clearSelection = () => {
    setSelectedTransactions(new Set())
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
              className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                selectedAccountId === acc.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {acc.is_main_membership_account && (
                <IconStarFilled className="size-4 text-yellow-500" title="Main Membership Payment Account" />
              )}
              {acc.account_name}
              {acc.account_number && (
                <span className="ml-1 text-xs opacity-70">
                  •••{acc.account_number.slice(-4)}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {currentAccount && !currentAccount.is_donation_account && !currentAccount.is_main_membership_account && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const res = await fetch('/api/finance/accounts', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      accountId: selectedAccountId,
                      isMainMembershipAccount: true
                    })
                  })
                  if (res.ok) {
                    showToast('Account set as main membership payment account', 'success')
                    // Update local state
                    setAccounts(accounts.map(a => ({
                      ...a,
                      is_main_membership_account: a.id === selectedAccountId
                    })))
                  } else {
                    showToast('Failed to set main account', 'error')
                  }
                } catch {
                  showToast('Failed to set main account', 'error')
                }
              }}
              disabled={loading}
              title="Set this account as the main membership payment account (used in payment reminders)"
            >
              <IconStar className="mr-2 size-4" />
              Set as Main
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddAccountDialog(true)}
            disabled={loading}
          >
            <IconPlus className="mr-2 size-4" />
            Add Account
          </Button>
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

      {/* Upload Progress - Indeterminate Loading Animation */}
      {uploading && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <p className="text-sm font-medium">Uploading & Processing...</p>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full animate-pulse"
                  style={{
                    width: '40%',
                    animation: 'indeterminate 1.5s ease-in-out infinite'
                  }}
                />
              </div>
              <style jsx>{`
                @keyframes indeterminate {
                  0% { transform: translateX(-100%); }
                  50% { transform: translateX(150%); }
                  100% { transform: translateX(-100%); }
                }
              `}</style>
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

      {/* Search Bar - Under Month Selector */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={searchType} onValueChange={(v: any) => setSearchType(v)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="description">Description</SelectItem>
              <SelectItem value="name">Transaction Name</SelectItem>
              <SelectItem value="amount">Amount</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder={`Search all transactions by ${searchType}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              </div>
            )}
          </div>
          {searchQuery && (
            <Button variant="ghost" size="icon" onClick={() => {
              setSearchQuery('')
              setSearchResults([])
            }}>
              <IconX className="size-4" />
            </Button>
          )}
        </div>
        
        {/* Search Results */}
        {searchQuery && searchResults.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="max-h-64 overflow-y-auto divide-y">
                {searchResults.map((txn) => (
                  <button
                    key={txn.id}
                    className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                    onClick={() => handleTransactionClick(txn)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{txn.transaction_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{txn.description}</p>
                        <p className="text-xs text-muted-foreground">{new Date(txn.transaction_date).toLocaleDateString('en-AU')}</p>
                      </div>
                      <span className={`ml-3 font-medium ${
                        txn.category === 'Charges' ? 'text-foreground' 
                        : txn.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {txn.category === 'Charges' ? '' : txn.transaction_type === 'credit' ? '+' : '-'}${Math.abs(txn.amount).toFixed(2)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        {searchQuery && searchResults.length === 0 && !searching && (
          <p className="text-sm text-muted-foreground text-center py-2">No transactions found</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Primary actions - Add/Upload */}
        <Button variant="outline" disabled={loading} onClick={() => setShowAddTransactionDialog(true)}>
          <IconPlus className="mr-2 size-4" />
          Add Transaction
        </Button>
        <label htmlFor="statement-upload">
          <Button variant="outline" asChild disabled={uploading}>
            <span>
              <IconUpload className="mr-2 size-4" />
              {uploading ? 'Uploading...' : 'Upload Statement'}
            </span>
          </Button>
        </label>
        
        {/* Secondary actions - Outlined */}
        <Button variant="outline" onClick={() => setShowChargeMemberDialog(true)}>
          Charge Member
        </Button>
        <Button 
          variant="outline" 
          onClick={() => {
            setShowPaymentRemindersDialog(true)
            loadRemindersPreview()
          }}
        >
          <IconSend className="mr-2 size-4" />
          Send Reminders
        </Button>
        <Button variant="outline" onClick={() => setShowBankAccountDialog(true)}>
          <IconBuildingBank className="mr-2 size-4" />
          Edit Bank Account
        </Button>
        
        {/* Destructive - at the end */}
        <div className="flex-1" />
        <Button 
          variant="destructive" 
          onClick={handleClearAll} 
          disabled={loading || transactions.length === 0}
        >
          <IconTrash className="mr-2 size-4" />
          Clear All
        </Button>
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">Transactions</h2>
              {!selectMode ? (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectMode(true)}
                >
                  Select
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={selectAllTransactions}
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={clearSelection}
                  >
                    Clear
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={handleDeleteSelectedTransactions}
                    disabled={selectedTransactions.size === 0 || deletingSelected}
                  >
                    <IconTrash className="size-4 mr-1" />
                    {deletingSelected ? 'Deleting...' : `Delete (${selectedTransactions.size})`}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setSelectMode(false)
                      setSelectedTransactions(new Set())
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground md:hidden">Swipe to see more →</p>
          </div>
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b">
                  {selectMode && <th className="text-left py-3 px-2 w-10"></th>}
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
                    <td colSpan={selectMode ? 7 : 6} className="text-center py-8 text-muted-foreground">
                      No transactions yet
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn) => (
                    <tr 
                      key={txn.id} 
                      className={`border-b hover:bg-muted/50 transition-colors cursor-pointer ${
                        selectedTransactions.has(txn.id) ? 'bg-primary/10' : ''
                      }`}
                      onClick={() => selectMode ? toggleTransactionSelection(txn.id) : handleTransactionClick(txn)}
                    >
                      {selectMode && (
                        <td className="py-3 px-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox 
                            checked={selectedTransactions.has(txn.id)}
                            onCheckedChange={() => toggleTransactionSelection(txn.id)}
                          />
                        </td>
                      )}
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
                        {txn.transaction_type === 'debit' ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                            N/A
                          </span>
                        ) : (
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
                                {searchingMembers ? (
                                  <div className="p-2 space-y-2">
                                    <div className="h-10 bg-muted/50 rounded animate-pulse" />
                                    <div className="h-10 bg-muted/50 rounded animate-pulse" />
                                    <div className="h-10 bg-muted/50 rounded animate-pulse" />
                                  </div>
                                ) : memberSearchResults.length === 0 && memberSearchQuery ? (
                                  <CommandEmpty>No members found</CommandEmpty>
                                ) : (
                                  <>
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
                                        <span className="font-medium">{member.name}</span>
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
                                  </>
                                )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        )}
                      </td>
                      <td className="py-3 px-2" onClick={(e) => e.stopPropagation()}>
                        {txn.category === 'Charges' ? (
                          <div className="w-[150px] h-8 text-xs bg-background text-foreground border border-input rounded-md flex items-center justify-center">
                            Charges
                          </div>
                        ) : txn.transaction_type === 'debit' ? (
                          <div className="w-[150px] h-8 text-xs bg-muted text-muted-foreground border border-input rounded-md flex items-center justify-center">
                            N/A
                          </div>
                        ) : (
                          <Select 
                            value={
                              // Normalize category to valid dropdown options
                              txn.category === 'Membership Payment' ? 'Membership Payment' :
                              txn.category === 'Donation' ? 'Donation' :
                              txn.category === 'Special Payment' || txn.category === 'Event Payment' ? 'Special Payment' :
                              'Special Payment' // Default fallback
                            }
                            onValueChange={(value) => handleUpdateCategory(txn.id, value)}
                          >
                            <SelectTrigger className="w-[150px] h-8 text-xs bg-background text-foreground border-input justify-center">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border-input">
                              <SelectItem value="Membership Payment" className="text-foreground cursor-pointer">Membership Payment</SelectItem>
                              <SelectItem value="Special Payment" className="text-foreground cursor-pointer">Special Payment</SelectItem>
                              <SelectItem value="Donation" className="text-foreground cursor-pointer">Donation</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className={`py-3 px-2 text-right font-medium ${
                        // Charges get black/neutral text with no +/-
                        txn.category === 'Charges'
                          ? 'text-foreground'
                        // Mark membership payments under the fee in orange
                          : txn.category === 'Membership Payment' && Math.abs(txn.amount) < monthlyFee
                          ? 'text-orange-600 dark:text-orange-400'
                          : txn.transaction_type === 'credit' 
                          ? 'text-green-600 dark:text-green-400' 
                          : txn.transaction_type === 'debit'
                          ? 'text-red-600 dark:text-red-400'
                          : txn.amount > 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        <div className="flex items-center justify-end gap-1">
                          {txn.category !== 'Charges' && (txn.transaction_type === 'credit' || (txn.transaction_type === 'adjustment' && txn.amount > 0)) && <IconArrowUp className="size-3" />}
                          {txn.category !== 'Charges' && (txn.transaction_type === 'debit' || (txn.transaction_type === 'adjustment' && txn.amount < 0)) && <IconArrowDown className="size-3" />}
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
                {selectedTransaction?.category === 'Charges' ? (
                  <div className="w-48 h-10 mt-1 bg-background text-foreground border border-input rounded-md flex items-center justify-center">
                    Charges
                  </div>
                ) : selectedTransaction?.transaction_type === 'debit' ? (
                  <div className="w-48 h-10 mt-1 bg-muted text-muted-foreground border border-input rounded-md flex items-center justify-center">
                    N/A
                  </div>
                ) : (
                  <Select 
                    value={dialogCategory} 
                    onValueChange={(v) => setDialogCategory(v)}
                  >
                    <SelectTrigger className="w-48 mt-1 justify-center">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Membership Payment">Membership Payment</SelectItem>
                      <SelectItem value="Special Payment">Special Payment</SelectItem>
                      <SelectItem value="Donation">Donation</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Only show Matched Member for credits, not debits */}
              {selectedTransaction?.transaction_type !== 'debit' && (
              <div>
                <Label className="text-muted-foreground text-xs">Matched Member</Label>
                <div className="mt-1">
                  <Popover open={dialogMemberPopoverOpen} onOpenChange={setDialogMemberPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {selectedTransaction.matched_member_name || 'No member matched'}
                        <IconChevronDown className="size-4 ml-2" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder="Search members..." 
                          value={dialogMemberSearchQuery}
                          onValueChange={setDialogMemberSearchQuery}
                        />
                        <CommandList>
                          {searchingMembers ? (
                            <div className="p-2 space-y-2">
                              <div className="h-8 bg-muted/50 rounded animate-pulse" />
                              <div className="h-8 bg-muted/50 rounded animate-pulse" />
                              <div className="h-8 bg-muted/50 rounded animate-pulse" />
                            </div>
                          ) : memberSearchResults.length === 0 && dialogMemberSearchQuery ? (
                            <CommandEmpty>No members found</CommandEmpty>
                          ) : (
                            <CommandGroup>
                              <CommandItem
                                onSelect={() => {
                                  handleMatchMember(selectedTransaction.id, null)
                                  setDialogMemberSearchQuery('')
                                  setDialogMemberPopoverOpen(false)
                                }}
                              >
                                <span className="text-muted-foreground">Remove match</span>
                              </CommandItem>
                              {memberSearchResults.map(member => (
                                <CommandItem
                                  key={member.id}
                                  onSelect={() => {
                                    handleMatchMember(selectedTransaction.id, member.id)
                                    setDialogMemberSearchQuery('')
                                    setDialogMemberPopoverOpen(false)
                                  }}
                                >
                                  {member.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Type</Label>
                  <p className={`font-semibold ${
                    selectedTransaction.category === 'Charges'
                      ? 'text-foreground'
                      : selectedTransaction.transaction_type === 'credit'
                      ? 'text-green-600 dark:text-green-400'
                      : selectedTransaction.transaction_type === 'debit'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}>
                    {selectedTransaction.category === 'Charges' ? 'Charge' : selectedTransaction.transaction_type}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Amount</Label>
                  <p className={`font-bold text-xl ${
                    selectedTransaction.category === 'Charges'
                      ? 'text-foreground'
                      : selectedTransaction.transaction_type === 'credit'
                      ? 'text-green-600 dark:text-green-400'
                      : selectedTransaction.transaction_type === 'debit'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}>
                    {selectedTransaction.category === 'Charges'
                      ? formatCurrency(Math.abs(selectedTransaction.amount))
                      : (
                        <>
                          {selectedTransaction.transaction_type === 'credit' ? '+' : '-'}
                          {formatCurrency(Math.abs(selectedTransaction.amount))}
                        </>
                      )}
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

              {selectedTransaction.created_at && (
                <div>
                  <Label className="text-muted-foreground text-xs">Created At</Label>
                  <p className="text-sm">
                    {new Date(selectedTransaction.created_at).toLocaleString('en-AU', {
                      dateStyle: 'long',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
              )}

              {selectedTransaction.statement_file_name && (
                <div className="border-t pt-4">
                  <Label className="text-muted-foreground text-xs">Bank Statement</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <IconFileText className="size-4 text-blue-500" />
                    <div className="flex-1">
                      {selectedTransaction.statement_file_url ? (
                        <a 
                          href={selectedTransaction.statement_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-sm text-blue-600 hover:text-blue-800 underline hover:no-underline"
                        >
                          {selectedTransaction.statement_file_name}
                        </a>
                      ) : (
                      <p className="font-medium text-sm">{selectedTransaction.statement_file_name}</p>
                      )}
                      {selectedTransaction.statement_date_from && selectedTransaction.statement_date_to && (
                        <p className="text-xs text-muted-foreground">
                          {formatDate(selectedTransaction.statement_date_from)} - {formatDate(selectedTransaction.statement_date_to)}
                        </p>
                      )}
                    </div>
                    {selectedTransaction.statement_file_url && (
                      <a 
                        href={selectedTransaction.statement_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <IconDownload className="size-4" />
                      </a>
                    )}
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
                  Delete
                </Button>
                <div className="flex gap-2">
                  {dialogCategory && dialogCategory !== selectedTransaction.category && (
                    <Button 
                      onClick={async () => {
                        setSavingDialog(true)
                        try {
                          const res = await fetch('/api/finance/transactions', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              transactionId: selectedTransaction.id,
                              category: dialogCategory
                            })
                          })
                          if (res.ok) {
                            showToast('Category updated!', 'success')
                            loadTransactions()
                            setShowTransactionDialog(false)
                          } else {
                            showToast('Failed to update category', 'error')
                          }
                        } catch (err) {
                          showToast('Failed to update category', 'error')
                        } finally {
                          setSavingDialog(false)
                        }
                      }}
                      disabled={savingDialog}
                    >
                      {savingDialog ? 'Saving...' : 'Save Changes'}
                    </Button>
                  )}
                <Button 
                  variant="outline"
                    onClick={() => {
                      setShowTransactionDialog(false)
                      setDialogCategory('')
                    }}
                >
                  Close
                </Button>
                </div>
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
              <Label htmlFor="account-number">Account Number (6 digits) *</Label>
              <Input
                id="account-number"
                value={newAccountNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '')
                  if (value.length <= 6) {
                    setNewAccountNumber(value)
                  }
                }}
                placeholder="123456"
                className="mt-1"
                maxLength={6}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {newAccountNumber.length}/6 digits
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
                disabled={!newAccountName.trim() || newAccountNumber.length !== 6 || newAccountBSB.replace(/-/g, '').length !== 6 || loading}
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
            <Label htmlFor="txn-category">Category *</Label>
            <Select value={newTransactionCategory} onValueChange={(value: 'Membership Payment' | 'Special Payment' | 'Donation') => setNewTransactionCategory(value)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Membership Payment">Membership Payment</SelectItem>
                <SelectItem value="Event Payment">Event Payment</SelectItem>
                <SelectItem value="Donation">Donation</SelectItem>
              </SelectContent>
            </Select>
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
              <Popover open={addTxnPopoverOpen} onOpenChange={setAddTxnPopoverOpen}>
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
                      {addTxnSearching ? (
                        <div className="p-2 space-y-2">
                          <div className="h-10 bg-muted/50 rounded animate-pulse" />
                          <div className="h-10 bg-muted/50 rounded animate-pulse" />
                          <div className="h-10 bg-muted/50 rounded animate-pulse" />
                        </div>
                      ) : addTxnMemberResults.length === 0 && addTxnMemberQuery ? (
                        <CommandEmpty>No members found</CommandEmpty>
                      ) : (
                      <CommandGroup>
                        {addTxnMemberResults.map((member) => (
                          <CommandItem
                            key={member.id}
                            onSelect={() => {
                              setNewTransactionMemberId(member.id)
                              setNewTransactionMemberName(member.name)
                              setAddTxnMemberQuery('')
                              setAddTxnMemberResults([])
                              setAddTxnPopoverOpen(false)
                            }}
                            className="cursor-pointer"
                          >
                              <span className="font-medium">{member.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      )}
                      {newTransactionMemberId && (
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => {
                              setNewTransactionMemberId(null)
                              setNewTransactionMemberName('')
                              setAddTxnPopoverOpen(false)
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

      {/* Charge Member Dialog */}
      <Dialog open={showChargeMemberDialog} onOpenChange={setShowChargeMemberDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Charge Member</DialogTitle>
            <DialogDescription>
              Add an expected payment for a member. This reduces their balance and creates a record of what they owe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="charge-member">Member *</Label>
              <Popover open={chargeMemberPopoverOpen} onOpenChange={setChargeMemberPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between mt-1"
                  >
                    {chargeMemberName || "Select member..."}
                    <IconSearch className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput 
                      placeholder="Search member..." 
                      value={chargeMemberQuery}
                      onValueChange={setChargeMemberQuery}
                    />
                    <CommandList>
                      {chargeMemberResults.length === 0 && chargeMemberQuery ? (
                        <CommandEmpty>No members found</CommandEmpty>
                      ) : (
                      <CommandGroup>
                        {chargeMemberResults.slice(0, 10).map((member) => (
                          <CommandItem
                            key={member.id}
                            onSelect={() => {
                              setChargeMemberId(member.id)
                              setChargeMemberName(member.name)
                              setChargeMemberQuery('')
                              setChargeMemberPopoverOpen(false)
                            }}
                            className="cursor-pointer"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{member.name}</span>
                              <span className="text-xs text-muted-foreground">{member.phone}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {chargeMemberName && (
                <p className="text-xs text-muted-foreground mt-1">
                  Selected: {chargeMemberName}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="charge-amount">Amount ($) *</Label>
              <Input
                id="charge-amount"
                type="number"
                step="0.01"
                min="0"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="charge-reason">Reason *</Label>
              <Input
                id="charge-reason"
                value={chargeReason}
                onChange={(e) => setChargeReason(e.target.value)}
                placeholder="e.g., Event ticket, Special fee"
                className="mt-1"
              />
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowChargeMemberDialog(false)
                  setChargeAmount('')
                  setChargeReason('')
                  setChargeMemberId(null)
                  setChargeMemberName('')
                  setChargeMemberQuery('')
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleChargeMember} 
                disabled={!chargeMemberId || !chargeAmount || !chargeReason || chargingMember}
              >
                {chargingMember ? 'Charging...' : 'Charge Member'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bank Account Settings Dialog */}
      <Dialog open={showBankAccountDialog} onOpenChange={setShowBankAccountDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Bank Account</DialogTitle>
            <DialogDescription>
              Update the main membership account details shown in payment reminders.
            </DialogDescription>
          </DialogHeader>
          <BankAccountSettings />
        </DialogContent>
      </Dialog>

      {/* Payment Reminders Dialog */}
      <Dialog open={showPaymentRemindersDialog} onOpenChange={setShowPaymentRemindersDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Send Payment Reminders</DialogTitle>
            <DialogDescription>
              Send SMS payment reminders to all members with outstanding balances.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4">
            {loadingRemindersPreview ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
              </div>
            ) : remindersPreview.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>🎉 All members are up to date!</p>
                <p className="text-sm mt-2">No outstanding balances found.</p>
              </div>
            ) : (
              <>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Name</th>
                        <th className="px-4 py-2 text-left font-medium">Phone</th>
                        <th className="px-4 py-2 text-right font-medium">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {remindersPreview.map((member) => (
                        <tr key={member.id} className="hover:bg-muted/30">
                          <td className="px-4 py-2">{member.name}</td>
                          <td className="px-4 py-2 text-muted-foreground">{member.phone}</td>
                          <td className="px-4 py-2 text-right text-red-600 dark:text-red-400 font-medium">
                            -${Math.abs(member.balance).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setShowPaymentRemindersDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendReminders}
              disabled={sendingReminders || remindersPreview.length === 0}
            >
              <IconSend className="mr-2 size-4" />
              {sendingReminders ? 'Sending...' : `Send to ${remindersPreview.length} Members`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

