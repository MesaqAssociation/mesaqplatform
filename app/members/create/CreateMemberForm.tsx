"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Group = {
  id: string | null
  name: string
  legacy?: boolean
}

type CustomField = {
  key: string
  name: string
  type: string
}

export default function CreateMemberForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [customData, setCustomData] = useState<Record<string, string>>({})

  // Load groups and custom fields on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [groupsRes, fieldsRes] = await Promise.all([
          fetch('/api/groups'),
          fetch('/api/settings/custom-fields')
        ])
        
        if (groupsRes.ok) {
          const data = await groupsRes.json()
          setGroups(data.groups || [])
        }
        
        if (fieldsRes.ok) {
          const data = await fieldsRes.json()
          setCustomFields(data.fields || [])
        }
      } catch (err) {
        console.error('Failed to load data:', err)
      }
    }
    loadData()
  }, [])

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    password: '',
    role: 'Community Member',
    group_name: '',
    banking_name: '',
    payment_identifiers: '',
    member_id: '',
    date_joined: new Date().toISOString().split('T')[0], // Default to today
    household_members: '1',
  })

  // Get days in month
  function getDaysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate()
  }


  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    
    setImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)

    // Start upload immediately
    setUploadProgress(0)
    setError(null)
    try {
      const imageForm = new FormData()
      imageForm.append('file', file)

      // Simulate progress (since fetch doesn't provide upload progress easily)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev === null) return 10
          if (prev >= 90) return 90
          return prev + 10
        })
      }, 200)

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: imageForm,
      })

      clearInterval(progressInterval)

      if (!uploadRes.ok) {
        throw new Error('Upload failed')
      }

      const { url } = await uploadRes.json()
      setImageUrl(url)
      setUploadProgress(100)
      setTimeout(() => setUploadProgress(null), 1000)
    } catch (err: any) {
      setError(err.message || 'Image upload failed')
      setUploadProgress(null)
      setImageFile(null)
      setImagePreview(null)
    }
  }

  // Validation helpers
  const validatePhone = (phone: string): boolean => {
    // Remove spaces, dashes, parentheses
    const cleaned = phone.replace(/[\s\-\(\)]/g, '')
    // Check if it's 10 digits (Australian format) or starts with +61 and has appropriate length
    return /^0\d{9}$/.test(cleaned) || /^\+61\d{9}$/.test(cleaned) || /^61\d{9}$/.test(cleaned)
  }

  const validateEmail = (email: string): boolean => {
    // Standard email regex
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return // Prevent double submission
    setLoading(true)
    setError(null)

    // Validate phone if provided
    if (formData.phone && !validatePhone(formData.phone)) {
      setError('Invalid phone number. Please enter a valid 10-digit Australian phone number (e.g., 0412345678)')
      setLoading(false)
      return
    }

    // Validate email if provided
    if (formData.email && !validateEmail(formData.email)) {
      setError('Invalid email address. Please enter a valid email (e.g., example@email.com)')
      setLoading(false)
      return
    }

    try {
      // Create member
      const res = await fetch('/api/members/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, image: imageUrl, custom_data: customData }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to create member')
      }
      // Keep loading state during redirect
      router.push('/members?success=Member created successfully')
    } catch (err: any) {
      setError(err.message || 'Error creating member')
      setLoading(false)
    }
  }

  const canSubmit = !loading && uploadProgress === null

  return (
    <form onSubmit={onSubmit} className="space-y-6" autoComplete="off">
      <div>
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          className="mt-1"
          autoComplete="off"
        />
      </div>

      <Separator />

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="mt-1"
          autoComplete="off"
        />
      </div>

      <Separator />

      <div>
        <Label htmlFor="phone">Phone Number *</Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          placeholder="0456789012"
          required
          className="mt-1"
          autoComplete="off"
        />
      </div>

      <Separator />

      <div>
        <Label htmlFor="password">Password * (minimum 8 characters)</Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required
          minLength={8}
          className="mt-1"
          autoComplete="new-password"
        />
      </div>

      <Separator />

      <div>
        <Label htmlFor="role">Role *</Label>
        <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select role" />
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

      <div>
        <Label htmlFor="group_name">Group (for event organization rotation)</Label>
        <Select 
          value={formData.group_name || "no-group"} 
          onValueChange={(value) => setFormData({ ...formData, group_name: value === "no-group" ? "" : value })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select a group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="no-group">No Group</SelectItem>
            {groups.map(group => (
              <SelectItem key={group.id || group.name} value={group.name}>{group.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          Groups take turns organizing community events
        </p>
      </div>

      <Separator />

      <div>
        <Label htmlFor="household_members">Household Members</Label>
        <Select value={formData.household_members} onValueChange={(value) => setFormData({ ...formData, household_members: value })}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
              <SelectItem key={num} value={num.toString()}>
                {num}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div>
        <Label htmlFor="banking_name">Banking Name</Label>
        <Input
          id="banking_name"
          value={formData.banking_name}
          onChange={(e) => setFormData({ ...formData, banking_name: e.target.value })}
          placeholder="e.g., JOHN SMITH or ALI, MAX (comma-separated for multiple)"
          className="mt-1"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground mt-1">
          💡 Separate multiple banking names with commas (e.g., "ALI, MAX")
        </p>
      </div>

      <Separator />

      <div>
        <Label htmlFor="payment_identifiers">Payment Identifiers</Label>
        <Input
          id="payment_identifiers"
          value={formData.payment_identifiers}
          onChange={(e) => setFormData({ ...formData, payment_identifiers: e.target.value })}
          placeholder="e.g., ABC123, DEF456 (comma-separated for multiple)"
          className="mt-1"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground mt-1">
          💡 Unique strings this member puts in their payment descriptions. Separate multiple with commas.
        </p>
      </div>

      <Separator />

      <div>
        <Label htmlFor="member_id">Member ID (e.g., A01, A02, B01)</Label>
        <Input
          id="member_id"
          type="text"
          value={formData.member_id}
          onChange={(e) => setFormData({ ...formData, member_id: e.target.value.toUpperCase() })}
          placeholder="e.g., A01, A02, B01..."
          className="mt-1"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground mt-1">
          💡 Unique ID for this member in format A01, A02, etc. Used to match payments in bank statements.
        </p>
      </div>

      <Separator />

      <div>
        <Label htmlFor="date_joined">Date Joined</Label>
        <div className="flex gap-2 mt-1">
          <Select 
            value={formData.date_joined.split('-')[2]} 
            onValueChange={(day) => {
              const [year, month] = formData.date_joined.split('-')
              setFormData({ ...formData, date_joined: `${year}-${month}-${day}` })
            }}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(() => {
                const [year, month] = formData.date_joined.split('-')
                const daysInMonth = getDaysInMonth(parseInt(year), parseInt(month))
                return Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                  <SelectItem key={day} value={day.toString().padStart(2, '0')}>
                    {day.toString().padStart(2, '0')}
                  </SelectItem>
                ))
              })()}
            </SelectContent>
          </Select>
          <Select 
            value={formData.date_joined.split('-')[1]} 
            onValueChange={(month) => {
              const [year, , day] = formData.date_joined.split('-')
              setFormData({ ...formData, date_joined: `${year}-${month}-${day}` })
            }}
          >
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="01">January</SelectItem>
              <SelectItem value="02">February</SelectItem>
              <SelectItem value="03">March</SelectItem>
              <SelectItem value="04">April</SelectItem>
              <SelectItem value="05">May</SelectItem>
              <SelectItem value="06">June</SelectItem>
              <SelectItem value="07">July</SelectItem>
              <SelectItem value="08">August</SelectItem>
              <SelectItem value="09">September</SelectItem>
              <SelectItem value="10">October</SelectItem>
              <SelectItem value="11">November</SelectItem>
              <SelectItem value="12">December</SelectItem>
            </SelectContent>
          </Select>
          <Select 
            value={formData.date_joined.split('-')[0]} 
            onValueChange={(year) => {
              const [, month, day] = formData.date_joined.split('-')
              setFormData({ ...formData, date_joined: `${year}-${month}-${day}` })
            }}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div>
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="Start typing address..."
          className="mt-1"
          autoComplete="off"
        />
      </div>

      <Separator />

      <div>
        <Label htmlFor="image">Profile Image</Label>
        <Input
          id="image"
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          disabled={uploadProgress !== null}
          className="mt-1"
        />
        {imagePreview && (
          <div className="mt-3">
            <img src={imagePreview} alt="Preview" className="w-24 h-24 object-cover rounded-lg" />
          </div>
        )}
        {uploadProgress !== null && (
          <div className="mt-3 space-y-2">
            <Progress value={uploadProgress} className="w-full" />
            <p className="text-sm text-muted-foreground">Uploading: {uploadProgress}%</p>
          </div>
        )}
      </div>

      {/* Custom Fields */}
      {customFields.length > 0 && (
        <>
          <Separator />
          <div className="space-y-4">
            <p className="text-sm font-medium text-muted-foreground">Additional Information</p>
            {customFields.map(field => (
              <div key={field.key}>
                <Label htmlFor={`custom-${field.key}`}>{field.name}</Label>
                <Input
                  id={`custom-${field.key}`}
                  value={customData[field.key] || ''}
                  onChange={(e) => setCustomData({ ...customData, [field.key]: e.target.value })}
                  className="mt-1"
                  autoComplete="off"
                />
              </div>
            ))}
          </div>
        </>
      )}

      {error ? (
        <>
          <Separator />
          <p className="text-sm text-red-600">{error}</p>
        </>
      ) : null}

      <Separator />

      <div className="flex gap-3">
        <Button type="submit" disabled={!canSubmit}>
          {loading ? 'Creating Member...' : uploadProgress !== null ? 'Uploading...' : 'Create Member'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/members')} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
