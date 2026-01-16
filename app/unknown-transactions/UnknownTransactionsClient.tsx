"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { IconAlertCircle, IconArrowUp, IconChevronDown, IconX, IconCheck } from '@tabler/icons-react'
import { showToast } from '@/lib/toast'

type Transaction = {
  id: string
  transaction_date: string
  transaction_name: string
  description: string
  amount: number
  transaction_type: string
  category: string
  balance_after: number | null
  source: string | null
  account_name: string
}

type Member = {
  id: string
  name: string
  member_id?: string
  banking_name?: string
}

export default function UnknownTransactionsClient() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  
  // Member search
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [memberSearchResults, setMemberSearchResults] = useState<Member[]>([])
  const [searchingMembers, setSearchingMembers] = useState(false)
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null)

  useEffect(() => {
    loadTransactions()
  }, [])

  // Debounced member search
  useEffect(() => {
    if (!memberSearchQuery.trim()) {
      setMemberSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setSearchingMembers(true)
      try {
        const res = await fetch(`/api/members?search=${encodeURIComponent(memberSearchQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setMemberSearchResults(data.members || [])
        }
      } catch (err) {
        console.error('Member search failed:', err)
      } finally {
        setSearchingMembers(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [memberSearchQuery])

  const loadTransactions = async () => {
    try {
      const res = await fetch('/api/finance/unknown-transactions')
      if (res.ok) {
        const data = await res.json()
        setTransactions(data.transactions || [])
      }
    } catch (err) {
      console.error('Failed to load transactions:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleMatchMember = async (transactionId: string, memberId: string) => {
    setUpdating(transactionId)
    try {
      const res = await fetch('/api/finance/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId,
          matchedMemberId: memberId,
        }),
      })

      if (res.ok) {
        showToast('✅ Transaction matched to member', 'success')
        // Remove from list
        setTransactions(prev => prev.filter(t => t.id !== transactionId))
        setOpenPopoverId(null)
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to match member', 'error')
      }
    } catch (err) {
      console.error('Failed to match member:', err)
      showToast('Failed to match member', 'error')
    } finally {
      setUpdating(null)
    }
  }

  const handleUpdateCategory = async (transactionId: string, category: string) => {
    setUpdating(transactionId)
    try {
      const res = await fetch('/api/finance/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId,
          category,
        }),
      })

      if (res.ok) {
        showToast('Category updated', 'success')
        setTransactions(prev => prev.map(t => 
          t.id === transactionId ? { ...t, category } : t
        ))
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to update category', 'error')
      }
    } catch (err) {
      console.error('Failed to update category:', err)
      showToast('Failed to update category', 'error')
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
        <h1 className="text-2xl font-semibold">Unknown Transactions</h1>
        <p className="text-muted-foreground">Credit transactions without a matched member</p>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <IconAlertCircle className="size-5 text-orange-500" />
                {loading ? '...' : transactions.length} Unknown Transaction{transactions.length !== 1 ? 's' : ''}
              </h2>
            </div>
          </div>
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <table className="w-full text-sm min-w-[1000px]">
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
                        <Skeleton className="h-8 w-32" />
                      </td>
                      <td className="py-3 px-2">
                        <Skeleton className="h-8 w-36" />
                      </td>
                      <td className="py-3 px-2 text-right">
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12">
                      <IconCheck className="size-12 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
                      <p className="text-muted-foreground">No unknown transactions</p>
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn) => (
                    <tr key={txn.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-2 whitespace-nowrap">
                        {formatDate(txn.transaction_date)}
                      </td>
                      <td className="py-3 px-2 font-medium max-w-[200px] truncate">
                        {txn.transaction_name}
                      </td>
                      <td className="py-3 px-2 text-muted-foreground max-w-[250px] truncate">
                        {txn.description || '-'}
                      </td>
                      <td className="py-3 px-2">
                        <Popover 
                          open={openPopoverId === txn.id} 
                          onOpenChange={(open) => {
                            if (open) {
                              setOpenPopoverId(txn.id)
                              setMemberSearchQuery('')
                              setMemberSearchResults([])
                            } else {
                              setOpenPopoverId(null)
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <button
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 hover:opacity-70 transition-colors"
                              disabled={updating === txn.id}
                            >
                              Unknown
                              <IconChevronDown className="ml-1 size-3" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-0" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput 
                                placeholder="Search member by name, phone..." 
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
                                  <CommandGroup>
                                    {memberSearchResults.map((member) => (
                                      <CommandItem
                                        key={member.id}
                                        onSelect={() => handleMatchMember(txn.id, member.id)}
                                        className="cursor-pointer"
                                      >
                                        <span className="font-medium">{member.name}</span>
                                        {member.member_id && (
                                          <span className="ml-2 text-xs text-muted-foreground">#{member.member_id}</span>
                                        )}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </td>
                      <td className="py-3 px-2">
                        <Select 
                          value={txn.category || 'Special Payment'}
                          onValueChange={(value) => handleUpdateCategory(txn.id, value)}
                          disabled={updating === txn.id}
                        >
                          <SelectTrigger className="w-[150px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Membership Payment">Membership Payment</SelectItem>
                            <SelectItem value="Special Payment">Special Payment</SelectItem>
                            <SelectItem value="Donation">Donation</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 px-2 text-right font-medium text-green-600 dark:text-green-400">
                        <div className="flex items-center justify-end gap-1">
                          <IconArrowUp className="size-3" />
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
    </div>
  )
}

