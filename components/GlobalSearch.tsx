"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { IconSearch, IconUser, IconCalendarEvent, IconUsersGroup } from '@tabler/icons-react'

type MemberResult = {
  type: 'member'
  id: string | number
  name: string
  email?: string
  phone?: string
  role?: string
}

type EventResult = {
  type: 'event' | 'meeting'
  id: string | number
  title: string
  event_date?: string
  location?: string
  event_type?: string
}

type SearchResult = MemberResult | EventResult

export default function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{
    members: MemberResult[]
    events: EventResult[]
    meetings: EventResult[]
  }>({
    members: [],
    events: [],
    meetings: []
  })
  const [searching, setSearching] = useState(false)

  // Keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults({ members: [], events: [], meetings: [] })
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          const data = await res.json()
          console.log('Search results:', data)
          setResults({
            members: data.members || [],
            events: data.events || [],
            meetings: data.meetings || []
          })
        } else {
          console.error('Search API error:', res.status, res.statusText)
        }
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = (type: string, id: string | number) => {
    if (type === 'member') {
      router.push(`/members/${id}`)
    } else if (type === 'event' || type === 'meeting') {
      router.push(`/events/${id}`)
    }
    setOpen(false)
    setQuery('')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground border rounded-md hover:bg-accent hover:text-accent-foreground transition-colors w-full"
      >
        <IconSearch className="size-4" />
        <span>Search...</span>
        <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Search members, events, meetings..." 
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {searching ? 'Searching...' : query.length < 2 ? 'Type at least 2 characters' : 'No results found'}
          </CommandEmpty>
          
          {results.members.length > 0 && (
            <CommandGroup heading="Members">
              {results.members.map((member) => (
                <CommandItem
                  key={`member-${member.id}`}
                  onSelect={() => handleSelect('member', member.id)}
                  className="cursor-pointer"
                >
                  <IconUser className="mr-2 size-4" />
                  <div className="flex flex-col">
                    <span className="font-medium">{member.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {member.email} • {member.phone}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.events.length > 0 && (
            <CommandGroup heading="Events">
              {results.events.map((event) => (
                <CommandItem
                  key={`event-${event.id}`}
                  onSelect={() => handleSelect('event', event.id)}
                  className="cursor-pointer"
                >
                  <IconCalendarEvent className="mr-2 size-4" />
                  <div className="flex flex-col">
                    <span className="font-medium">{event.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {event.event_date && new Date(event.event_date).toLocaleDateString('en-AU')}
                      {event.location && ` • ${event.location}`}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.meetings.length > 0 && (
            <CommandGroup heading="Meetings">
              {results.meetings.map((meeting) => (
                <CommandItem
                  key={`meeting-${meeting.id}`}
                  onSelect={() => handleSelect('meeting', meeting.id)}
                  className="cursor-pointer"
                >
                  <IconUsersGroup className="mr-2 size-4" />
                  <div className="flex flex-col">
                    <span className="font-medium">{meeting.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {meeting.event_date && new Date(meeting.event_date).toLocaleDateString('en-AU')}
                      {meeting.location && ` • ${meeting.location}`}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}

