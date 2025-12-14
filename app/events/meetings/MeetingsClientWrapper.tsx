"use client"

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { showToast } from '@/lib/toast'

export default function MeetingsClientWrapper({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()

  // Show success toast if redirected with success param
  useEffect(() => {
    const success = searchParams.get('success')
    if (success) {
      showToast(success, 'success')
      // Clean up URL
      window.history.replaceState({}, '', '/events/meetings')
    }
  }, [searchParams])

  return <>{children}</>
}
