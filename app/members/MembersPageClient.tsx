"use client"

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import MembersClient from './MembersClient'
import { IconX } from '@tabler/icons-react'
import { useI18n } from '@/components/I18nProvider'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

type Member = {
  id: string
  phone: string
  name: string | null
  email: string | null
  address: string | null
  image: string | null
  role: string | null
}

export default function MembersPageClient({ initial, isAdmin = true }: { initial: Member[], isAdmin?: boolean }) {
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  useEffect(() => {
    const success = searchParams.get('success')
    if (success) {
      setToastMessage(success)
      setShowToast(true)
      
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setShowToast(false)
      }, 5000)

      // Clean up URL
      window.history.replaceState({}, '', '/members')

      return () => clearTimeout(timer)
    }
  }, [searchParams])

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">{t("members")}</h1>
        {isAdmin && (
          <Link href="/members/create">
            <Button>{t("createNew")}</Button>
          </Link>
        )}
      </div>
      <MembersClient initial={initial} isAdmin={isAdmin} />
      
      {showToast && (
        <div 
          className="fixed bottom-4 right-4 bg-[#34b14e] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-md animate-in slide-in-from-right z-50"
          style={{ animation: 'slideInRight 0.3s ease-out' }}
        >
          <span className="flex-1">{toastMessage}</span>
          <button
            onClick={() => setShowToast(false)}
            className="text-white hover:text-white/80 transition-colors"
            aria-label="Close"
          >
            <IconX className="size-5" />
          </button>
        </div>
      )}
    </div>
  )
}

