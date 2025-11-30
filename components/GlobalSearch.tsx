"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { IconSearch, IconUser, IconX } from '@tabler/icons-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Member = {
  id: string
  name: string
  email?: string
  phone?: string
  member_id?: number
}

export default function GlobalSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [showResults, setShowResults] = useState(false)
  const [searching, setSearching] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setMembers([])
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&membersOnly=true`)
        if (res.ok) {
          const data = await res.json()
          setMembers(data.members || [])
          setShowResults(true)
        }
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const handleSelectMember = (member: Member) => {
    // Navigate to member's page
    router.push(`/members/${member.member_id || member.id}`)
    setQuery('')
    setShowResults(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search members..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          className="pl-9"
        />
      </div>

      {/* Search Results Dropdown */}
      {showResults && members.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50 max-h-[300px] overflow-y-auto">
          {searching ? (
            <div className="px-3 py-2 text-sm text-muted-foreground text-center">
              Searching...
            </div>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                onClick={() => handleSelectMember(member)}
                className="px-3 py-2 hover:bg-accent cursor-pointer border-b last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <IconUser className="size-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{member.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {member.email && <span>{member.email}</span>}
                      {member.email && member.phone && <span> • </span>}
                      {member.phone && <span>{member.phone}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showResults && query.length >= 2 && members.length === 0 && !searching && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50 px-3 py-2 text-sm text-muted-foreground text-center">
          No members found
        </div>
      )}
    </div>
  )
}

