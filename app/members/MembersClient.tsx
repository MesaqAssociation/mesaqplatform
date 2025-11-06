"use client"

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useI18n } from '@/components/I18nProvider'

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
}

export default function MembersClient({ initial }: { initial: Member[] }) {
  const { t } = useI18n()
  const router = useRouter()
  
  const getRoleTranslation = (role: string | null) => {
    if (role === 'Manager') return t('manager')
    if (role === 'Public Officer') return t('publicOfficer')
    if (role === 'Finance Officer') return t('financeOfficer')
    if (role === 'Logistics Officer') return t('logisticsOfficer')
    return t('communityMember')
  }

  const getPaymentStatusBadge = (status: string | null) => {
    // Don't show badge for N/A (not joined yet)
    if (status === 'N/A') return null
    
    const configs = {
      'PAID': { bg: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'PAID' },
      'UNPAID': { bg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'UNPAID' },
      'OVERDUE': { bg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'OVERDUE' },
      'REVIEW': { bg: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'REVIEW' },
    }
    
    // Default to UNPAID if status is null, empty, or unknown
    const config = configs[status as keyof typeof configs] || configs.UNPAID
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg}`}>
        {config.label}
      </span>
    )
  }
  
  return (
    <div className="overflow-auto">
      <table className="min-w-[800px] w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="py-3 px-2">{t("name")}</th>
            <th className="py-3 px-2">{t("email")}</th>
            <th className="py-3 px-2">{t("phone")}</th>
            <th className="py-3 px-2">{t("householdMembers")}</th>
            <th className="py-3 px-2">{t("role")}</th>
            <th className="py-3 px-2">Payment Status</th>
          </tr>
        </thead>
        <tbody>
          {initial.map(m => (
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
                {getPaymentStatusBadge(m.payment_status)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
