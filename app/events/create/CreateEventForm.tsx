"use client"

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { IconTrash } from '@tabler/icons-react'
import { showToast } from '@/lib/toast'

type AgendaItem = {
  id: string
  title: string
  time: string
}

export default function CreateEventForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isMeeting = searchParams.get('type') === 'meeting'

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([])
  const [availableGroups, setAvailableGroups] = useState<string[]>([])
  const [lastOrganizingGroup, setLastOrganizingGroup] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    address: '',
    estimated_cost: '',
    event_date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '10:00',
    organizing_group: '',
    notify_group: true,
  })

  // Get days in month
  function getDaysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate()
  }

  // Load available groups and last organizing group
  useEffect(() => {
    const loadGroups = async () => {
      try {
        // Get groups from API
        const res = await fetch('/api/groups')
        if (res.ok) {
          const data = await res.json()
          const groupNames = (data.groups || []).map((g: any) => g.name)
          setAvailableGroups(groupNames.sort())
        }

        // Get last organizing group
        const lastGroupRes = await fetch('/api/events/last-organizing-group')
        if (lastGroupRes.ok) {
          const lastGroupData = await lastGroupRes.json()
          setLastOrganizingGroup(lastGroupData.lastGroup)
        }
      } catch (err) {
        console.error('Failed to load groups:', err)
      }
    }
    loadGroups()
  }, [])


  // Generate time options in 15-minute increments (12-hour format)
  // Start times: 00:15 to 23:45 (no midnight start)
  // End times: Include midnight at the END of the list
  const generateTimeOptions = (forEndTime: boolean = false, startTime?: string) => {
    const times: { value: string; label: string }[] = []
    
    // Generate times from 00:00 to 23:45
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const h24 = hour.toString().padStart(2, '0')
        const m = minute.toString().padStart(2, '0')
        const value = `${h24}:${m}`
        
        // Skip midnight for start time
        if (!forEndTime && value === '00:00') continue
        
        // Convert to 12-hour format for display
        const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
        const period = hour < 12 ? 'AM' : 'PM'
        const label = value === '00:00' ? '12:00 AM (Midnight)' : `${h12}:${m.toString().padStart(2, '0')} ${period}`
        
        times.push({ value, label })
      }
    }
    
    // For end time, filter and reorder
    if (forEndTime && startTime) {
      // Filter times after start time, treating 00:00 as 24:00 for comparison
      const filtered = times.filter(t => {
        const tValue = t.value === '00:00' ? '24:00' : t.value
        return tValue > startTime
      })
      
      // Move midnight to the end if it exists
      const midnightIndex = filtered.findIndex(t => t.value === '00:00')
      if (midnightIndex > -1) {
        const [midnight] = filtered.splice(midnightIndex, 1)
        filtered.push(midnight)
      }
      
      return filtered
    }
    
    return times
  }

  const startTimeOptions = generateTimeOptions(false)
  const endTimeOptions = generateTimeOptions(true, formData.start_time)

  // Get valid times for agenda items (between start and end time)
  const getValidAgendaTimes = () => {
    const start = formData.start_time
    const end = formData.end_time
    // Treat 00:00 as 24:00 for comparison
    const endCompare = end === '00:00' ? '24:00' : end
    return startTimeOptions.filter(time => time.value >= start && time.value <= endCompare)
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
          notify_group: formData.notify_group,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to create event')
      }
      showToast(isMeeting ? 'Meeting created successfully!' : 'Event created successfully!', 'success')
      router.push(isMeeting ? '/events/meetings' : '/events')
    } catch (err: any) {
      setError(err.message || 'Error creating event')
      showToast(err.message || 'Error creating event', 'error')
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
          id="address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          className="mt-1"
          autoComplete="off"
        />
      </div>

      <Separator />

      <div>
        <Label htmlFor="organizing_group">Organizing Group</Label>
        <Select value={formData.organizing_group} onValueChange={(value) => setFormData({ ...formData, organizing_group: value })}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select which group is organizing this event" />
          </SelectTrigger>
          <SelectContent>
            {availableGroups.map(group => (
              <SelectItem key={group} value={group}>{group}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {lastOrganizingGroup && (
          <p className="text-xs text-muted-foreground mt-1">
            💡 Last event was organized by: <strong>{lastOrganizingGroup}</strong>
          </p>
        )}
        
        {formData.organizing_group && (
          <div className="flex items-center space-x-2 mt-3">
            <Checkbox 
              id="notify_group" 
              checked={formData.notify_group}
              onCheckedChange={(checked) => setFormData({ ...formData, notify_group: checked === true })}
            />
            <label 
              htmlFor="notify_group" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Notify group members via WhatsApp
            </label>
          </div>
        )}
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
              {startTimeOptions.map(time => (
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
              {endTimeOptions.map(time => (
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

