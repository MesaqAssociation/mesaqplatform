"use client"

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { IconTrash } from '@tabler/icons-react'

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

type AgendaItem = {
  id: string
  title: string
  time: string
}

export default function CreateEventForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isMeeting = searchParams.get('type') === 'meeting'
  const addressInputRef = useRef<HTMLInputElement>(null)
  const mapsLoaded = useGoogleMaps()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([])

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    address: '',
    attendees: [] as string[],
    estimated_cost: '',
    event_date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '10:00',
    email_attendees: false,
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

  // Generate time options in 15-minute increments (12-hour format)
  const generateTimeOptions = () => {
    const times: { value: string; label: string }[] = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const h24 = hour.toString().padStart(2, '0')
        const m = minute.toString().padStart(2, '0')
        const value = `${h24}:${m}`
        
        // Convert to 12-hour format for display
        const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
        const period = hour < 12 ? 'AM' : 'PM'
        const label = `${h12}:${m} ${period}`
        
        times.push({ value, label })
      }
    }
    return times
  }

  const timeOptions = generateTimeOptions()

  // Get valid times for agenda items (between start and end time)
  const getValidAgendaTimes = () => {
    const start = formData.start_time
    const end = formData.end_time
    return timeOptions.filter(time => time.value >= start && time.value <= end)
  }

  function addAgendaItem() {
    const newItem: AgendaItem = {
      id: Math.random().toString(36).substr(2, 9),
      title: '',
      time: formData.start_time,
    }
    setAgendaItems([...agendaItems, newItem])
  }

  function removeAgendaItem(id: string) {
    setAgendaItems(agendaItems.filter(item => item.id !== id))
  }

  function updateAgendaItem(id: string, field: 'title' | 'time', value: string) {
    setAgendaItems(agendaItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  function toggleAttendee(value: string) {
    setFormData(prev => ({
      ...prev,
      attendees: prev.attendees.includes(value)
        ? prev.attendees.filter(a => a !== value)
        : [...prev.attendees, value]
    }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/events/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          event_type: isMeeting ? 'Meeting' : 'Event',
          agenda: agendaItems,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to create event')
      }
      router.push(isMeeting ? '/events/meetings?success=Meeting created successfully' : '/events?success=Event created successfully')
    } catch (err: any) {
      setError(err.message || 'Error creating event')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" autoComplete="off">
      <div>
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
          className="mt-1"
          autoComplete="off"
        />
      </div>

      <Separator />

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="mt-1 min-h-[100px]"
          placeholder="Describe the event..."
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
        <Label>Attendees *</Label>
        <div className="mt-2 space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="board-members" 
              checked={formData.attendees.includes('Board Members')}
              onCheckedChange={() => toggleAttendee('Board Members')}
            />
            <label htmlFor="board-members" className="text-sm cursor-pointer">
              Board Members
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="head-board-member" 
              checked={formData.attendees.includes('Head Board Member')}
              onCheckedChange={() => toggleAttendee('Head Board Member')}
            />
            <label htmlFor="head-board-member" className="text-sm cursor-pointer">
              Head Board Member
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="community-members" 
              checked={formData.attendees.includes('Community Members')}
              onCheckedChange={() => toggleAttendee('Community Members')}
            />
            <label htmlFor="community-members" className="text-sm cursor-pointer">
              Community Members
            </label>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <Label htmlFor="estimated_cost">Estimated Cost</Label>
        <div className="relative mt-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            id="estimated_cost"
            type="text"
            value={formData.estimated_cost}
            onChange={(e) => {
              const value = e.target.value
              // Only allow numbers and one decimal point, max 2 decimal places
              if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                setFormData({ ...formData, estimated_cost: value })
              }
            }}
            className="pl-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            placeholder="0.00"
            autoComplete="off"
          />
        </div>
      </div>

      <Separator />

      <div>
        <Label htmlFor="event_date">Date *</Label>
        <div className="flex gap-2 mt-1">
          <Select 
            value={formData.event_date.split('-')[2]} 
            onValueChange={(day) => {
              const [year, month] = formData.event_date.split('-')
              setFormData({ ...formData, event_date: `${year}-${month}-${day}` })
            }}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(() => {
                const [year, month] = formData.event_date.split('-')
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
            value={formData.event_date.split('-')[1]} 
            onValueChange={(month) => {
              const [year, , day] = formData.event_date.split('-')
              setFormData({ ...formData, event_date: `${year}-${month}-${day}` })
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
            value={formData.event_date.split('-')[0]} 
            onValueChange={(year) => {
              const [, month, day] = formData.event_date.split('-')
              setFormData({ ...formData, event_date: `${year}-${month}-${day}` })
            }}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i).map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start_time">Start Time *</Label>
          <Select 
            value={formData.start_time} 
            onValueChange={(value) => setFormData({ ...formData, start_time: value })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeOptions.map(time => (
                <SelectItem key={time.value} value={time.value}>
                  {time.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="end_time">End Time *</Label>
          <Select 
            value={formData.end_time} 
            onValueChange={(value) => setFormData({ ...formData, end_time: value })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeOptions.map(time => (
                <SelectItem key={time.value} value={time.value}>
                  {time.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div>
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="email_attendees" 
            checked={formData.email_attendees}
            onCheckedChange={(checked) => setFormData({ ...formData, email_attendees: checked as boolean })}
          />
          <label htmlFor="email_attendees" className="text-sm cursor-pointer">
            Email Attendees
          </label>
        </div>
      </div>

      <Separator />

      <div>
        <Label>Agenda</Label>
        <div className="mt-3 space-y-3">
          {agendaItems.map((item) => (
            <div key={item.id} className="flex gap-2 items-start">
              <Input
                value={item.title}
                onChange={(e) => updateAgendaItem(item.id, 'title', e.target.value)}
                placeholder="Agenda item title"
                className="flex-1"
                autoComplete="off"
              />
              <Select 
                value={item.time} 
                onValueChange={(value) => updateAgendaItem(item.id, 'time', value)}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getValidAgendaTimes().map(time => (
                    <SelectItem key={time.value} value={time.value}>
                      {time.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeAgendaItem(item.id)}
              >
                <IconTrash className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addAgendaItem} className="w-full">
            Add Agenda Item
          </Button>
        </div>
      </div>

      {error ? (
        <>
          <Separator />
          <p className="text-sm text-red-600">{error}</p>
        </>
      ) : null}

      <Separator />

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating...' : `Create ${isMeeting ? 'Meeting' : 'Event'}`}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/events')} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

