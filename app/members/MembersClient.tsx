"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Member = { id: string; phone: string; name: string | null }

export default function MembersClient({ initial }: { initial: Member[] }) {
  const [members, setMembers] = useState<Member[]>(initial)
  const [showForm, setShowForm] = useState(false)
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to create')
      }
      setPhone('')
      setPassword('')
      setShowForm(false)
      // refresh list
      const list = await fetch('/api/members').then(r => r.json()).catch(() => null)
      if (list?.members) setMembers(list.members)
    } catch (err: any) {
      setError(err.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Members</h2>
        <Button onClick={() => setShowForm(v => !v)}>{showForm ? 'Cancel' : 'Create New'}</Button>
      </div>
      {showForm && (
        <form onSubmit={onCreate} className="grid gap-3 max-w-sm">
          <Input placeholder="Phone (e.g. 0456789012)" value={phone} onChange={e => setPhone(e.target.value)} required />
          <Input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create'}</Button>
        </form>
      )}
      <div className="overflow-auto">
        <table className="min-w-[400px] w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-2">Phone</th>
              <th className="py-2">Name</th>
              <th className="py-2">Role</th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id} className="border-t">
                <td className="py-2">{m.phone}</td>
                <td className="py-2">{m.name || '-'}</td>
                <td className="py-2">Board Member</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


