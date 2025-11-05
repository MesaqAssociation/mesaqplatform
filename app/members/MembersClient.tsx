"use client"

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
}

export default function MembersClient({ initial }: { initial: Member[] }) {
  const { t } = useI18n()
  
  const getRoleTranslation = (role: string | null) => {
    if (role === 'Head Board Member') return t('headBoardMember')
    if (role === 'Board Member') return t('boardMember')
    return t('communityMember')
  }
  
  return (
    <div className="overflow-auto">
      <table className="min-w-[700px] w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="py-3 px-2">{t("name")}</th>
            <th className="py-3 px-2">{t("email")}</th>
            <th className="py-3 px-2">{t("phone")}</th>
            <th className="py-3 px-2">{t("householdMembers")}</th>
            <th className="py-3 px-2">{t("role")}</th>
          </tr>
        </thead>
        <tbody>
          {initial.map(m => (
            <tr key={m.id} className="border-t hover:bg-muted/50 transition-colors">
              <td className="py-3 px-2">
                <Link href={`/members/${m.member_id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={m.image || '/placeholder-user.jpg'} alt={m.name || 'User'} />
                    <AvatarFallback>{m.name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{m.name || '-'}</span>
                </Link>
              </td>
              <td className="py-3 px-2 text-muted-foreground">{m.email || '-'}</td>
              <td className="py-3 px-2 text-muted-foreground">{m.phone}</td>
              <td className="py-3 px-2 text-muted-foreground">{m.household_members || '-'}</td>
              <td className="py-3 px-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  m.role === 'Head Board Member' 
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    : m.role === 'Board Member'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                }`}>
                  {getRoleTranslation(m.role)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
