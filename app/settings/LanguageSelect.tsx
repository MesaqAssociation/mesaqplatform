"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/components/I18nProvider'
import { Locale } from '@/lib/i18n'

const options: Array<{ value: Locale; label: string }> = [
  { value: 'en', label: '🇺🇸 English' },
  { value: 'ar', label: '🇸🇦 Arabic' },
  { value: 'fa', label: '🇮🇷 Persian' },
]

export default function LanguageSelect() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{t("language")}</label>
      <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t("language")} />
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

