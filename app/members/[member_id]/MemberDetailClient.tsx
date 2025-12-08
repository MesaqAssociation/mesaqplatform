"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { IconArrowLeft, IconMail, IconPhone, IconMapPin, IconCalendar, IconUsers, IconCreditCard, IconUserCircle, IconTrash, IconArrowUp, IconArrowDown, IconReceipt, IconChevronDown, IconCheck } from '@tabler/icons-react'
// BalanceCardNew removed per request (special balance hidden)
import { showToast } from '@/lib/toast'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

type Member = {
  id: string
  member_id: string
  name: string
  email: string | null
  phone: string
  address: string | null
  image: string | null
  role: string
  banking_name: string | null
  date_joined: string | null
  household_members: number
  created_at: string | null
}

type Event = {
  id: string
  title: string
  event_date: string
  event_type: string
  description?: string | null
  address?: string | null
}

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
}

export default function MemberDetailClient({ 
  member, 
  attendedEvents, 
  allEvents,
  transactions,
  isAdmin
}: { 
  member: Member
  attendedEvents: Event[]
  allEvents: Event[]
  transactions: Transaction[]
  isAdmin: boolean
}) {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>(attendedEvents || [])
  const [loading, setLoading] = useState(false)
  const [currentRole, setCurrentRole] = useState(member.role)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [openTransactionMonth, setOpenTransactionMonth] = useState<string | null>(null)
  const [convertingTxn, setConvertingTxn] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(true)

  useEffect(() => {
    const loadBalance = async () => {
      try {
        const res = await fetch(`/api/membership/balance/${member.id}`)
        if (res.ok) {
          const data = await res.json()
          // Use membershipBalance.currentBalance and ignore special/donation
          const current = Number(data?.membershipBalance?.currentBalance ?? 0)
          setBalance(current)
        }
      } catch (err) {
        console.error('Failed to load balance', err)
      } finally {
        setBalanceLoading(false)
      }
    }
    loadBalance()
  }, [member.id])

  // Group transactions by month
  const transactionsByMonth = transactions.reduce((acc, txn) => {
    const date = new Date(txn.transaction_date + 'T00:00:00')
    const monthKey = date.toISOString().slice(0, 7) // YYYY-MM format
    const monthName = date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
    
    if (!acc[monthKey]) {
      acc[monthKey] = {
        monthName,
        transactions: []
      }
    }
    acc[monthKey].transactions.push(txn)
    return acc
  }, {} as Record<string, { monthName: string, transactions: Transaction[] }>)

  // Sort months in descending order (most recent first)
  const sortedMonths = Object.keys(transactionsByMonth).sort((a, b) => b.localeCompare(a))

  async function addEvent(eventId: string) {
    if (!isAdmin) return
    setLoading(true)
    try {
      const res = await fetch('/api/members/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id, eventId }),
      })
      if (res.ok) {
        const event = allEvents.find(e => e.id === eventId)
        if (event) {
          setEvents([event, ...events])
        }
      }
    } catch (err) {
      console.error('Failed to add event', err)
    } finally {
      setLoading(false)
    }
  }

  async function removeEvent(eventId: string) {
    if (!isAdmin) return
    try {
      await fetch('/api/members/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id, eventId }),
      })
      setEvents(events.filter(e => e.id !== eventId))
    } catch (err) {
      console.error('Failed to remove event', err)
    }
  }

  async function handleRoleChange(newRole: string) {
    if (!isAdmin) return
    try {
      const res = await fetch(`/api/members/${member.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      if (res.ok) {
        setCurrentRole(newRole)
        showToast(`Role updated to ${newRole}`, 'success')
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to update role', 'error')
      }
    } catch (err) {
      console.error('Failed to update role', err)
      showToast('Failed to update role', 'error')
    }
  }

  async function handleDelete() {
    if (!isAdmin) return
    if (confirmText.toLowerCase() !== 'confirm') {
      showToast('Please type "confirm" to delete', 'error')
      return
    }

    setDeleting(true)
    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        showToast('Member deleted successfully', 'success')
        setTimeout(() => {
          router.push('/members')
          router.refresh()
        }, 1500)
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to delete member', 'error')
        setDeleting(false)
      }
    } catch (err) {
      console.error('Failed to delete member', err)
      showToast('Failed to delete member', 'error')
      setDeleting(false)
    }
  }

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    try {
      return new Date(date + 'T00:00:00').toLocaleDateString('en-AU', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      })
    } catch (error) {
      console.error('Date formatting error:', error, date)
      return '-'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(Math.abs(amount))
  }

  const handleConvertToMembership = async (txn: Transaction) => {
    if (!confirm(`Convert this $${Math.abs(txn.amount).toFixed(2)} transaction to a membership payment?`)) {
      return
    }

    setConvertingTxn(txn.id)
    try {
      const res = await fetch('/api/finance/convert-to-membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: txn.id,
          memberId: member.id,
          amount: Math.abs(txn.amount),
          transactionDate: txn.transaction_date
        })
      })

      const data = await res.json()

      if (res.ok) {
        showToast(`Converted to membership payment for ${data.monthName}`, 'success')
        // Refresh page to show updated data
        router.refresh()
      } else {
        showToast(data.error || 'Failed to convert transaction', 'error')
      }
    } catch (err) {
      console.error('Failed to convert transaction', err)
      showToast('Failed to convert transaction', 'error')
    } finally {
      setConvertingTxn(null)
    }
  }

  const availableEvents = (allEvents || []).filter(e => !events.find(ae => ae.id === e.id))

  // Safety check
  if (!member) {
    return (
      <div className="p-6">
        <p>Member not found</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl">
      <Link href="/members">
        <Button variant="ghost" className="mb-4">
          <IconArrowLeft className="mr-2 size-4" />
          Back to Members
        </Button>
      </Link>

      <div className="space-y-6">
        {/* Top Profile Strip */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={member.image || '/placeholder-user.jpg'} alt={member.name} />
                  <AvatarFallback className="text-3xl">{member.name?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-2xl font-semibold mb-1">{member.name}</h1>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-2 ${
                    member.role === 'Manager' 
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      : member.role === 'Public Officer' || member.role === 'Finance Officer' || member.role === 'Logistics Officer'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  }`}>
                    {member.role}
                  </span>
                  <p className="text-sm text-muted-foreground">Member #{member.member_id}</p>
                </div>
              </div>
              {/* Balance summary */}
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Membership Balance</p>
                <p className={`text-2xl font-bold ${Number(balance ?? 0) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                  ${Math.abs(Number(balance ?? 0)).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {Number(balance ?? 0) < 0 ? 'Outstanding' : 'Credit'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <IconMail className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{member.email || '-'}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <IconPhone className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{member.phone}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <IconMapPin className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{member.address || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Member Details */}
          <Card>
            <CardHeader>
              <CardTitle>Member Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <IconUsers className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Household Members</p>
                  <p className="font-medium">{member.household_members || 1}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <IconCalendar className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Date Joined</p>
                  <p className="font-medium">{formatDate(member.date_joined)}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <IconCreditCard className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Banking Name</p>
                  <p className="font-medium">{member.banking_name || '-'}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <IconUserCircle className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Member ID</p>
                  <p className="font-medium">{member.member_id || '-'}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <IconUserCircle className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Account Created</p>
                  <p className="font-medium">{formatDate(member.created_at ? member.created_at.split('T')[0] : null)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Balance (membership only; excludes special payments & donations) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconCreditCard className="size-5" />
                Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {balanceLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : (
                <div className="space-y-1">
                  <p className={`text-3xl font-bold ${Number(balance ?? 0) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                    ${Math.abs(Number(balance ?? 0)).toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {Number(balance ?? 0) < 0 ? 'Outstanding balance' : 'Credit balance'}
                  </p>
                  {!isAdmin && (
                    <p className="text-xs text-muted-foreground">
                      For adjustments, please contact admin/board.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Member Transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconReceipt className="size-5" />
                Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No transactions found for this member</p>
              ) : (
                <div className="space-y-2">
                  {sortedMonths.map(monthKey => {
                    const monthData = transactionsByMonth[monthKey]
                    return (
                      <Collapsible
                        key={monthKey}
                        open={openTransactionMonth === monthKey}
                        onOpenChange={(open) => setOpenTransactionMonth(open ? monthKey : null)}
                      >
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-2">
                              <IconChevronDown className={`size-4 transition-transform ${openTransactionMonth === monthKey ? 'rotate-180' : ''}`} />
                              <span className="font-medium">{monthData.monthName}</span>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {monthData.transactions.length} transaction{monthData.transactions.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 space-y-2">
                            {monthData.transactions.map(txn => (
                              <div key={txn.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors ml-6">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {txn.transaction_type === 'credit' || txn.amount > 0 ? (
                                    <IconArrowUp className="size-4 text-green-500 flex-shrink-0" />
                                  ) : (
                                    <IconArrowDown className="size-4 text-red-500 flex-shrink-0" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium truncate">{txn.transaction_name}</p>
                                    <p className="text-xs text-muted-foreground">{formatDate(txn.transaction_date)}</p>
                                    {txn.description && (
                                      <p className="text-xs text-muted-foreground truncate">{txn.description}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                  <div className="text-sm font-semibold">
                                    <span className={txn.transaction_type === 'credit' || txn.amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                      {txn.transaction_type === 'credit' || txn.amount > 0 ? '+' : '-'}
                                      {formatCurrency(txn.amount)}
                                    </span>
                                  </div>
                                  {(txn.transaction_type === 'credit' || txn.amount > 0) && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleConvertToMembership(txn)}
                                      disabled={convertingTxn === txn.id}
                                      title="Convert to membership payment"
                                    >
                                      <IconCheck className="size-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Events Attended */}
          <Card>
            <CardHeader>
              <CardTitle>Events Attended</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Add Event</label>
                <div className="flex gap-2">
                  <Select onValueChange={addEvent} disabled={loading || availableEvents.length === 0}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={availableEvents.length === 0 ? "No events available" : "Select an event..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEvents.map(event => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.title} ({formatDate(event.event_date)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No events attended yet</p>
                ) : (
                  events.map(event => (
                    <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="font-medium">{event.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(event.event_date)} • {event.event_type}
                        </p>
                      </div>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEvent(event.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Role Management */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Role Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="role">Change Role</Label>
                  <Select value={currentRole} onValueChange={handleRoleChange}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Community Member">Community Member</SelectItem>
                      <SelectItem value="Manager">Manager</SelectItem>
                      <SelectItem value="Public Officer">Public Officer</SelectItem>
                      <SelectItem value="Finance Officer">Finance Officer</SelectItem>
                      <SelectItem value="Logistics Officer">Logistics Officer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Danger Zone */}
          {isAdmin && (
            <Card className="border-red-200 dark:border-red-900">
              <CardHeader>
                <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Permanently delete this member account. This action cannot be undone.</p>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    className="w-full"
                  >
                    <IconTrash className="mr-2 size-4" />
                    Delete Member
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Member Account</DialogTitle>
            <DialogDescription>
              This will permanently delete {member.name}'s account and all associated data.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2">
            <Label htmlFor="confirm">Type "confirm" to delete</Label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="confirm"
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false)
                setConfirmText('')
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={confirmText.toLowerCase() !== 'confirm' || deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

