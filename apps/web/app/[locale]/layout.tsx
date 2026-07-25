import { notFound } from 'next/navigation'
import { SUPPORTED_LOCALES } from '@areia-bela/shared'
import { LanguageProvider } from '@/components/language-provider'
import type { Language } from '@/lib/i18n'

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) {
    notFound()
  }

  // The locale segment drives the language, so a shared /es link always
  // renders Spanish regardless of what the visitor picked last time.
  return <LanguageProvider language={locale as Language}>{children}</LanguageProvider>
}
