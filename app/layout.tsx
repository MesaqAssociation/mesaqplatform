import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { I18nProvider } from '@/components/I18nProvider'
import { Locale } from '@/lib/i18n'
import { cookies } from 'next/headers'

export const metadata: Metadata = {
  title: 'Mesaq Association',
  description: 'Association Management System',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Get locale from cookie or localStorage (server-side we use cookie)
  const localeCookie = cookies().get('locale')?.value as Locale | undefined
  const initialLocale = (["en", "ar", "fa"] as const).includes(localeCookie as any) 
    ? (localeCookie as Locale) 
    : "en"

  return (
    <html lang={initialLocale} dir={initialLocale === "fa" || initialLocale === "ar" ? "rtl" : "ltr"} className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body autoComplete="off">
        <I18nProvider initialLocale={initialLocale}>
          {children}
        </I18nProvider>
      </body>
    </html>
  )
}
