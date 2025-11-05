"use client"

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'

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
  })

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
      router.push('/members')
    } catch (err: any) {
      setError(err.message || 'Error creating member')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = !loading && uploadProgress === null

  return (
    <form onSubmit={onSubmit} className="space-y-6">
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
