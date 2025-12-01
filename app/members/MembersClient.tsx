"use client"

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useI18n } from '@/components/I18nProvider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Member = {
  id: string
  member_id: number
  phone: string
  name: string | null
  email: string | null
  address: string | null
  image: string | null
  role: string | null
  household_members: number | null
  payment_status: string | null
  total_paid: number | null
  monthly_fee: number | null
}

type SortOption = 'name-asc' | 'most-paid' | 'least-paid' | 'unpaid-first'

export default function MembersClient({ initial, isAdmin = true }: { initial: Member[], isAdmin?: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  const [sortBy, setSortBy] = useState<SortOption>('name-asc')
  
  const getRoleTranslation = (role: string | null) => {
    if (role === 'Manager') return t('manager')
    if (role === 'Public Officer') return t('publicOfficer')
    if (role === 'Finance Officer') return t('financeOfficer')
    if (role === 'Logistics Officer') return t('logisticsOfficer')
    return t('communityMember')
  }

  const getPaymentStatusBadge = (member: Member) => {
    const { payment_status } = member
    
    // Don't show badge for N/A (not joined yet)
    if (payment_status === 'N/A') return null
    
    // Only show PAID or UNPAID
    const isPaid = payment_status === 'PAID'
    
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

  // Sort members based on selected option
  const sortedMembers = useMemo(() => {
    const sorted = [...initial]
    
    switch (sortBy) {
      case 'name-asc':
        return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      
      case 'most-paid':
        return sorted.sort((a, b) => {
          const aTotal = a.total_paid || 0
          const bTotal = b.total_paid || 0
          return bTotal - aTotal // Highest first
        })
      
      case 'least-paid':
        return sorted.sort((a, b) => {
          const aTotal = a.total_paid || 0
          const bTotal = b.total_paid || 0
          return aTotal - bTotal // Lowest first
        })
      
      case 'unpaid-first':
        return sorted.sort((a, b) => {
          const aFee = a.monthly_fee || 0
          const aPaid = a.total_paid || 0
          const bFee = b.monthly_fee || 0
          const bPaid = b.total_paid || 0
          
          const aOwes = aFee - aPaid
          const bOwes = bFee - bPaid
          
          // Show those who owe the most first
          return bOwes - aOwes
        })
      
      default:
        return sorted
    }
  }, [initial, sortBy])
  
  return (
    <div className="space-y-4">
      {/* Filter Controls - Only show for admins */}
      {isAdmin && (
        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="text-sm font-medium">
            Sort by:
          </label>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Name (A-Z)</SelectItem>
              <SelectItem value="most-paid">Most Paid</SelectItem>
              <SelectItem value="least-paid">Least Paid</SelectItem>
              <SelectItem value="unpaid-first">Unpaid First</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

    <div className="overflow-auto">
      <table className="min-w-[800px] w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="py-3 px-2">{t("name")}</th>
              {isAdmin && (
                <>
            <th className="py-3 px-2">{t("email")}</th>
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
              onClick={() => m.member_id && router.push(`/members/${m.member_id}`)}
              className="border-t hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <td className="py-3 px-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={m.image || '/placeholder-user.jpg'} alt={m.name || 'User'} />
                    <AvatarFallback>{m.name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{m.name || '-'}</span>
                </div>
              </td>
              <td className="py-3 px-2 text-muted-foreground">{m.email || '-'}</td>
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
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
