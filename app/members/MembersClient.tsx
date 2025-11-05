"use client"

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

type Member = {
  id: string
  phone: string
  name: string | null
  email: string | null
  address: string | null
  image: string | null
  role: string | null
  household_members: number | null
}

export default function MembersClient({ initial }: { initial: Member[] }) {
  return (
    <div className="overflow-auto">
      <table className="min-w-[600px] w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="py-3 px-2">Name</th>
            <th className="py-3 px-2">Email</th>
            <th className="py-3 px-2">Phone Number</th>
            <th className="py-3 px-2">Household Members</th>
          </tr>
        </thead>
        <tbody>
          {initial.map(m => (
            <tr key={m.id} className="border-t hover:bg-muted/50 transition-colors">
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
