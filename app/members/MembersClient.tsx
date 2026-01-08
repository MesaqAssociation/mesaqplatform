"use client"

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useI18n } from '@/components/I18nProvider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getInitials } from '@/lib/utils'
import { IconSearch } from '@tabler/icons-react'

type Member = {
  id: string
  member_id: string
  phone: string
  name: string | null
  email: string | null
  address: string | null
  image: string | null
  role: string | null
  group_name: string | null
  household_members: number | null
  balance?: number | null
  current_balance?: number | null
  payment_status: string | null
  total_paid: number | null
  monthly_fee: number | null
}

type SortOption = 'name-asc' | 'most-paid' | 'least-paid' | 'unpaid-first' | 'id-asc' | 'id-desc'

export default function MembersClient({ initial, isAdmin = true }: { initial: Member[], isAdmin?: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  const [sortBy, setSortBy] = useState<SortOption>('name-asc')
  const [searchQuery, setSearchQuery] = useState('')
  
  const getRoleTranslation = (role: string | null) => {
    if (role === 'Manager') return t('manager')
    if (role === 'Public Officer') return t('publicOfficer')
    if (role === 'Finance Officer') return t('financeOfficer')
    if (role === 'Logistics Officer') return t('logisticsOfficer')
    return t('communityMember')
  }

  const getPaymentStatusBadge = (member: Member) => {
    const { payment_status, current_balance, balance } = member
    if (payment_status === 'N/A') return null
    const effectiveBalance = balance ?? current_balance ?? 0
    const isPaid = payment_status === 'PAID' || (payment_status === null && effectiveBalance >= 0)
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isPaid 
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      }`}>
        {isPaid ? 'PAID' : 'UNPAID'}
      </span>
    )
  }

  // Filter and sort members based on search query and selected option
  const sortedMembers = useMemo(() => {
    // First filter by search query
    let filtered = [...initial]
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(m => 
        (m.name?.toLowerCase().includes(query)) ||
        (m.phone?.includes(query)) ||
        (m.email?.toLowerCase().includes(query)) ||
        (m.group_name?.toLowerCase().includes(query)) ||
        (m.member_id?.toLowerCase().includes(query))
      )
    }
    
    // Then sort
    switch (sortBy) {
      case 'name-asc':
        return filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      
      case 'most-paid':
        return filtered.sort((a, b) => {
          const aTotal = a.total_paid || 0
          const bTotal = b.total_paid || 0
          return bTotal - aTotal // Highest first
        })
      
      case 'least-paid':
        return filtered.sort((a, b) => {
          const aTotal = a.total_paid || 0
          const bTotal = b.total_paid || 0
          return aTotal - bTotal // Lowest first
        })
      
      case 'unpaid-first':
        return filtered.sort((a, b) => {
          const aFee = a.monthly_fee || 0
          const aPaid = a.total_paid || 0
          const bFee = b.monthly_fee || 0
          const bPaid = b.total_paid || 0
          
          const aOwes = aFee - aPaid
          const bOwes = bFee - bPaid
          
          // Show those who owe the most first
          return bOwes - aOwes
        })
      
      case 'id-asc':
        return filtered.sort((a, b) => (a.member_id || '').localeCompare(b.member_id || ''))
      
      case 'id-desc':
        return filtered.sort((a, b) => (b.member_id || '').localeCompare(a.member_id || ''))
      
      default:
        return filtered
    }
  }, [initial, sortBy, searchQuery])
  
  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 w-full sm:max-w-sm">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {/* Sort Controls - Only show for admins */}
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor="sort" className="text-sm font-medium">
              Sort:
            </label>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                <SelectItem value="id-asc">Member ID (A-Z)</SelectItem>
                <SelectItem value="id-desc">Member ID (Z-A)</SelectItem>
                <SelectItem value="most-paid">Most Paid</SelectItem>
                <SelectItem value="least-paid">Least Paid</SelectItem>
                <SelectItem value="unpaid-first">Unpaid First</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => router.refresh()}>
              Refresh
            </Button>
          </div>
        )}
      </div>

      {/* Results count */}
      {searchQuery && (
        <p className="text-sm text-muted-foreground">
          Found {sortedMembers.length} member{sortedMembers.length !== 1 ? 's' : ''}
        </p>
      )}

    {/* Desktop: Table view */}
    <div className="hidden lg:block overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="py-3 px-2">{t("name")}</th>
              {isAdmin && (
                <>
            <th className="py-3 px-2">Member ID</th>
            <th className="py-3 px-2">{t("phone")}</th>
            <th className="py-3 px-2">{t("householdMembers")}</th>
            <th className="py-3 px-2">{t("role")}</th>
            <th className="py-3 px-2">Payment Status</th>
                </>
              )}
          </tr>
        </thead>
        <tbody>
            {sortedMembers.map(m => (
            <tr 
              key={m.id} 
              onClick={() => isAdmin && router.push(`/members/${m.id}`)}
              className={`border-t hover:bg-muted/50 transition-colors ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <td className="py-3 px-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={m.image || undefined} alt={m.name || 'User'} />
                    <AvatarFallback>{getInitials(m.name)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{m.name || '-'}</span>
                </div>
              </td>
              {isAdmin && (
                <>
              <td className="py-3 px-2 text-muted-foreground font-mono">{m.member_id || '-'}</td>
              <td className="py-3 px-2 text-muted-foreground">{m.phone}</td>
              <td className="py-3 px-2 text-muted-foreground">{m.household_members || '-'}</td>
              <td className="py-3 px-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  m.role === 'Manager' 
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    : m.role === 'Public Officer' || m.role === 'Finance Officer' || m.role === 'Logistics Officer'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                }`}>
                  {getRoleTranslation(m.role)}
                </span>
              </td>
              <td className="py-3 px-2">
                {getPaymentStatusBadge(m)}
              </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* Mobile: Card view */}
      <div className="lg:hidden space-y-3">
        {sortedMembers.map(m => (
          <div
            key={m.id}
            onClick={() => isAdmin && router.push(`/members/${m.id}`)}
            className={`border rounded-lg p-4 ${isAdmin ? 'cursor-pointer hover:bg-muted/50' : ''} transition-colors`}
          >
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={m.image || undefined} alt={m.name || 'User'} />
                <AvatarFallback>{getInitials(m.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{m.name || '-'}</p>
                {isAdmin && <p className="text-sm text-muted-foreground truncate">{m.phone}</p>}
              </div>
              {isAdmin && getPaymentStatusBadge(m)}
            </div>
            {isAdmin && (
              <div className="space-y-2 text-sm">
                {m.email && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="truncate ml-2">{m.email}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Household:</span>
                  <span>{m.household_members || '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Role:</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    m.role === 'Manager' 
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      : m.role === 'Public Officer' || m.role === 'Finance Officer' || m.role === 'Logistics Officer'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  }`}>
                    {getRoleTranslation(m.role)}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
