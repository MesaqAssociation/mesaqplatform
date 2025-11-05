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
}

export default function MembersClient({ initial }: { initial: Member[] }) {
  return (
    <div className="overflow-auto">
      <table className="min-w-[600px] w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="py-2">Member</th>
            <th className="py-2">Email</th>
            <th className="py-2">Phone</th>
            <th className="py-2">Address</th>
            <th className="py-2">Role</th>
          </tr>
        </thead>
        <tbody>
          {initial.map(m => (
            <tr key={m.id} className="border-t">
              <td className="py-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={m.image || '/placeholder-user.jpg'} alt={m.name || 'User'} />
                    <AvatarFallback>{m.name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <span>{m.name || '-'}</span>
                </div>
              </td>
              <td className="py-2">{m.email || '-'}</td>
              <td className="py-2">{m.phone}</td>
              <td className="py-2">{m.address || '-'}</td>
              <td className="py-2">{m.role || 'Community Member'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
