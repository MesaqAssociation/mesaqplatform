"use client"

import { useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const options = [
  { value: 'en', label: '🇺🇸 English' },
  { value: 'ar', label: '🇸🇦 Arabic' },
  { value: 'fa', label: '🇮🇷 Persian' },
  { value: 'fr', label: '🇫🇷 French' },
  { value: 'de', label: '🇩🇪 German' },
  { value: 'es', label: '🇪🇸 Spanish' },
  { value: 'hi', label: '🇮🇳 Hindi' },
  { value: 'zh', label: '🇨🇳 Chinese' },
  { value: 'ja', label: '🇯🇵 Japanese' },
  { value: 'ru', label: '🇷🇺 Russian' },
]

export default function LanguageSelect() {
  const [value, setValue] = useState<string>('en')

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('lang') : null
    if (saved) setValue(saved)
  }, [])

  function onChange(v: string) {
    setValue(v)
    try {
      localStorage.setItem('lang', v)
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('lang', v)
        if (v === 'ar' || v === 'fa') {
          document.documentElement.setAttribute('dir', 'rtl')
        } else {
          document.documentElement.setAttribute('dir', 'ltr')
        }
        // Reload page to apply language changes
        window.location.reload()
      }
    } catch {}
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select language" />
      </SelectTrigger>
      <SelectContent>
        {options.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}


