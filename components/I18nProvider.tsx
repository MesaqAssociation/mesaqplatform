"use client"

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react"
import { dicts, Locale } from "@/lib/i18n"

type I18nContext = {
  locale: Locale
  t: (k: keyof typeof dicts["en"]) => string
  setLocale: (l: Locale) => void
}

const I18nContext = createContext<I18nContext | null>(null)

export function I18nProvider({ 
  initialLocale, 
  children 
}: { 
  initialLocale: Locale
  children: ReactNode 
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  useEffect(() => {
    // Apply <html lang dir> immediately (no reload)
    const html = document.documentElement
    html.setAttribute("lang", locale)
    html.setAttribute("dir", locale === "fa" || locale === "ar" ? "rtl" : "ltr")
    
    // Persist so it sticks on next visit
    if (typeof window !== 'undefined') {
      localStorage.setItem("locale", locale)
      document.cookie = `locale=${locale}; path=/; max-age=${60*60*24*365}`
    }
  }, [locale])

  const t = useMemo(() => {
    const d = dicts[locale]
    return (k: keyof typeof dicts["en"]) => d[k] ?? String(k)
  }, [locale])

  function setLocale(l: Locale) {
    setLocaleState(l)
  }

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider")
  return ctx
}

