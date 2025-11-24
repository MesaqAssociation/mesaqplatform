"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { IconCheck, IconX } from '@tabler/icons-react'

type User = {
  id: string
  member_id: number
  name: string | null
  email: string | null
  phone: string | null
  address: string | null
  household_members: number | null
  joined_date: string | null
  created_at: string | null
}

type Props = {
  user: User
}

export default function UserSettings({ user }: Props) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    address: user.address || '',
    household_members: user.household_members?.toString() || '1',
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/user/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        setToastType('success')
        setToastMessage('Profile updated successfully!')
        setEditing(false)
        // Reload page to reflect changes
        setTimeout(() => window.location.reload(), 1500)
      } else {
        const data = await res.json()
        setToastType('error')
        setToastMessage(data.error || 'Failed to update profile')
      }
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    } catch (error) {
      setToastType('error')
      setToastMessage('An error occurred')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      address: user.address || '',
      household_members: user.household_members?.toString() || '1',
    })
    setEditing(false)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  return (
    <>
      <div className="border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Your Profile</h2>
          {!editing && (
            <Button onClick={() => setEditing(true)} variant="outline" size="sm">
              Edit Profile
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {/* Editable Fields */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Name *</label>
            {editing ? (
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Your name"
                className="mt-1"
              />
            ) : (
              <p className="text-sm mt-1">{user.name || 'N/A'}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Email</label>
            {editing ? (
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your.email@example.com"
                className="mt-1"
              />
            ) : (
              <p className="text-sm mt-1">{user.email || 'N/A'}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Phone *</label>
            {editing ? (
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="0412345678"
                className="mt-1"
              />
            ) : (
              <p className="text-sm mt-1">{user.phone || 'N/A'}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Address</label>
            {editing ? (
              <Textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Your address"
                className="mt-1"
                rows={3}
              />
            ) : (
              <p className="text-sm mt-1">{user.address || 'N/A'}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Household Members (total including you)
            </label>
            {editing ? (
              <Input
                type="number"
                min="1"
                value={formData.household_members}
                onChange={(e) => setFormData({ ...formData, household_members: e.target.value })}
                className="mt-1"
              />
            ) : (
              <p className="text-sm mt-1">{user.household_members || 1}</p>
            )}
          </div>

          {/* Read-only Fields */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Account Information (Read-only)</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Member ID</label>
                <p className="text-sm font-mono">#{user.member_id}</p>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Joined Date</label>
                <p className="text-sm">{formatDate(user.joined_date)}</p>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Account Created</label>
                <p className="text-sm">{formatDate(user.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {editing && (
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} disabled={saving}>
                <IconCheck className="mr-2 size-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button onClick={handleCancel} variant="outline" disabled={saving}>
                <IconX className="mr-2 size-4" />
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div 
          className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-md animate-in slide-in-from-right z-50 ${
            toastType === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          <span className="flex-1">{toastMessage}</span>
          <button
            onClick={() => setShowToast(false)}
            className="text-white hover:text-white/80 transition-colors"
          >
            <IconX className="size-5" />
          </button>
        </div>
      )}
    </>
  )
}

