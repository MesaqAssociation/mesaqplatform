"use client"

import { useEffect } from 'react'

export default function LangLoader() {
  useEffect(() => {
    const saved = localStorage.getItem('lang') || 'en'
    document.documentElement.setAttribute('lang', saved)
    if (saved === 'ar' || saved === 'fa') {
      document.documentElement.setAttribute('dir', 'rtl')
    } else {
      document.documentElement.setAttribute('dir', 'ltr')
    }
  }, [])
  return null
}

