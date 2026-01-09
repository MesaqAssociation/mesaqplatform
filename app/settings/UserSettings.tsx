"use client"

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { IconCheck, IconX, IconCamera, IconEye, IconEyeOff } from '@tabler/icons-react'
import { getInitials } from '@/lib/utils'

type User = {
  id: string
  member_id: number
  name: string | null
  email: string | null
  phone: string | null
  address: string | null
  image?: string | null
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Profile picture state
  const [uploadingImage, setUploadingImage] = useState(false)
  const [profileImage, setProfileImage] = useState(user.image || '')
  
  // Password change state
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    address: user.address || '',
    household_members: user.household_members?.toString() || '1',
  })

  const showNotification = (message: string, type: 'success' | 'error') => {
    setToastMessage(message)
    setToastType(type)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) {
        throw new Error('Upload failed')
      }

      const { url } = await uploadRes.json()
      
      // Update profile with new image URL
      const updateRes = await fetch('/api/user/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: url }),
      })

      if (updateRes.ok) {
        setProfileImage(url)
        showNotification('Profile picture updated!', 'success')
        // Reload to update sidebar
        setTimeout(() => window.location.reload(), 1500)
      } else {
        throw new Error('Failed to update profile')
      }
    } catch (error) {
      showNotification('Failed to upload image', 'error')
    } finally {
      setUploadingImage(false)
    }
  }

  const handlePasswordChange = async () => {
    if (newPassword.length < 8) {
      showNotification('Password must be at least 8 characters', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      showNotification('Passwords do not match', 'error')
      return
    }

    setChangingPassword(true)
    try {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      })

      if (res.ok) {
        showNotification('Password changed successfully!', 'success')
        setNewPassword('')
        setConfirmPassword('')
        setShowPasswordSection(false)
      } else {
        const data = await res.json()
        showNotification(data.error || 'Failed to change password', 'error')
      }
    } catch (error) {
      showNotification('An error occurred', 'error')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleSave = async () => {
    // Validate email format
    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email.trim())) {
        showNotification('Please enter a valid email address', 'error')
        return
      }
    }
    
    // Validate phone format (10-11 digits for Australian numbers)
    if (formData.phone && formData.phone.trim()) {
      const phoneDigits = formData.phone.replace(/\D/g, '')
      if (phoneDigits.length < 10 || phoneDigits.length > 11) {
        showNotification('Please enter a valid phone number (10-11 digits)', 'error')
        return
      }
    }
    
    setSaving(true)
    try {
      const res = await fetch('/api/user/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        showNotification('Profile updated successfully!', 'success')
        setEditing(false)
        setTimeout(() => window.location.reload(), 1500)
      } else {
        const data = await res.json()
        showNotification(data.error || 'Failed to update profile', 'error')
      }
    } catch (error) {
      showNotification('An error occurred', 'error')
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
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    } catch {
      return 'N/A'
    }
  }

  if (!user || !user.id) {
    return (
      <div className="border rounded-lg p-6 shadow-md">
        <p className="text-sm text-muted-foreground">Loading profile...</p>
      </div>
    )
  }

  return (
    <>
      {/* Profile Picture Section */}
      <div className="border rounded-lg p-6 shadow-md">
        <h2 className="text-lg font-medium mb-4">Profile Picture</h2>
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profileImage || undefined} alt={user.name || 'User'} />
              <AvatarFallback className="text-2xl">{getInitials(user.name || 'U')}</AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <IconCamera className="size-4" />
            </button>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Upload a new profile picture
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
            >
              {uploadingImage ? 'Uploading...' : 'Choose Image'}
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Profile Information Section */}
      <div className="border rounded-lg p-6 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Your Profile</h2>
          {!editing && (
            <Button onClick={() => setEditing(true)} variant="outline" size="sm">
              Edit Profile
            </Button>
          )}
        </div>

        <div className="space-y-4">
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

      {/* Change Password Section */}
      <div className="border rounded-lg p-6 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Change Password</h2>
          {!showPasswordSection && (
            <Button onClick={() => setShowPasswordSection(true)} variant="outline" size="sm">
              Change Password
            </Button>
          )}
        </div>

        {showPasswordSection ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">New Password *</label>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Confirm Password *</label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                className="mt-1"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                onClick={handlePasswordChange} 
                disabled={changingPassword || !newPassword || !confirmPassword}
              >
                {changingPassword ? 'Changing...' : 'Update Password'}
              </Button>
              <Button 
                onClick={() => {
                  setShowPasswordSection(false)
                  setNewPassword('')
                  setConfirmPassword('')
                }} 
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Click the button above to change your password.
          </p>
        )}
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
