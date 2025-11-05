"use client"

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Load Google Maps script
function useGoogleMaps() {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if ((window as any).google?.maps?.places) {
      setLoaded(true)
      return
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`
    script.async = true
    script.onload = () => setLoaded(true)
    document.head.appendChild(script)
  }, [])
  return loaded
}

export default function CreateMemberForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const addressInputRef = useRef<HTMLInputElement>(null)
  const mapsLoaded = useGoogleMaps()

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    password: '',
    role: 'Community Member',
    banking_name: '',
    date_joined: new Date().toISOString().split('T')[0], // Default to today
    household_members: '1',
  })

  // Get days in month
  function getDaysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate()
  }

  // Setup Google Maps autocomplete
  useEffect(() => {
    if (!mapsLoaded || !addressInputRef.current) return
    const autocomplete = new (window as any).google.maps.places.Autocomplete(addressInputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'au' },
      bounds: {
        north: -37.5,
        south: -38.5,
        east: 145.5,
        west: 144.5,
      },
      strictBounds: false,
    })
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (place.formatted_address) {
        setFormData(prev => ({ ...prev, address: place.formatted_address }))
      }
    })
  }, [mapsLoaded])

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return // Prevent double submission
    setLoading(true)
    setError(null)
    try {
      // Create member
      const res = await fetch('/api/members/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, image: imageUrl }),
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
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
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
            <SelectItem value="Board Member">Board Member</SelectItem>
            <SelectItem value="Head Board Member">Head Board Member</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div>
        <Label htmlFor="household_members">Household Members *</Label>
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
          placeholder="Name as it appears on bank account"
          className="mt-1"
          autoComplete="off"
        />
      </div>

      <Separator />

      <div>
        <Label htmlFor="date_joined">Date Joined *</Label>
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
          ref={addressInputRef}
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
