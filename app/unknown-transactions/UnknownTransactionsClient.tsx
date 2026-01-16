"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { IconAlertCircle, IconArrowUp, IconChevronDown, IconX, IconCheck, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
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

const ITEMS_PER_PAGE = 20

export default function UnknownTransactionsClient() {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  
  // Pagination calculations
  const totalPages = Math.ceil(allTransactions.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const transactions = allTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  
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
        setAllTransactions(data.transactions || [])
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
      const res = await fetch('/api/finance/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: [transactionId],
          action: 'match_member',
          matchedMemberId: memberId,
        }),
      })

      if (res.ok) {
        showToast('✅ Transaction matched to member', 'success')
        // Remove from list
        setAllTransactions(prev => prev.filter(t => t.id !== transactionId))
        setOpenPopoverId(null)
        // Reset page if needed
        if (currentPage > 1 && allTransactions.length - 1 <= (currentPage - 1) * ITEMS_PER_PAGE) {
          setCurrentPage(1)
        }
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
      const res = await fetch('/api/finance/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: [transactionId],
          action: 'update_category',
          category,
        }),
      })

      if (res.ok) {
        showToast('Category updated', 'success')
        setAllTransactions(prev => prev.map(t => 
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

  const handleKeepAsUnknown = async (transactionId: string) => {
    setUpdating(transactionId)
    try {
      const res = await fetch('/api/finance/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: [transactionId],
          action: 'mark_as_reviewed',
        }),
      })

      if (res.ok) {
        showToast('✅ Marked as reviewed', 'success')
        // Remove from list
        setAllTransactions(prev => prev.filter(t => t.id !== transactionId))
        // Reset page if needed
        if (currentPage > 1 && allTransactions.length - 1 <= (currentPage - 1) * ITEMS_PER_PAGE) {
          setCurrentPage(1)
        }
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to mark as reviewed', 'error')
      }
    } catch (err) {
      console.error('Failed to mark as reviewed:', err)
      showToast('Failed to mark as reviewed', 'error')
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
                {loading ? '...' : allTransactions.length} Unknown Transaction{allTransactions.length !== 1 ? 's' : ''}
              </h2>
              {totalPages > 1 && (
                <span className="text-sm text-muted-foreground">
                  (Page {currentPage} of {totalPages})
                </span>
              )}
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
                        <Skeleton className="h-8 w-32" />
                      </td>
                      <td className="py-3 px-2">
                        <Skeleton className="h-8 w-36" />
                      </td>
                      <td className="py-3 px-2 text-right">
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </td>
                      <td className="py-3 px-2">
                        <Skeleton className="h-8 w-24" />
                      </td>
                    </tr>
                  ))
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
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
                      <td className="py-3 px-2">
                        <Button
                          onClick={() => handleKeepAsUnknown(txn.id)}
                          disabled={updating === txn.id}
                          variant="outline"
                          size="sm"
                        >
                          {updating === txn.id ? '...' : 'Keep Unknown'}
                        </Button>
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
                Showing {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, allTransactions.length)} of {allTransactions.length}
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

