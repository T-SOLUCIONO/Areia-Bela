import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_LOGIN_PATH, LANGUAGE_COOKIE } from '@areia-bela/shared'
import { Toaster } from '@areia-bela/ui/sonner'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { AdminHeader } from '@/components/admin/admin-header'
import { TranslationProvider } from '@/components/admin/content/translation-provider'
import { AdminSessionProvider } from '@/components/admin/admin-session-provider'
import { AdminLanguageProvider } from '@/components/admin/admin-language-provider'
import { getAdminSession } from '@/lib/admin-session'
import type { Language } from '@/lib/i18n'

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  // The real gate: the middleware only sees whether a cookie exists, so this
  // is where the session is actually verified against the API.
  const session = await getAdminSession()
  if (!session) redirect(ADMIN_LOGIN_PATH)

  // Read server-side so the first paint is already in the right language.
  const saved = (await cookies()).get(LANGUAGE_COOKIE)?.value
  const language: Language = saved === 'en' ? 'en' : 'es'

  return (
    <AdminLanguageProvider initialLanguage={language}>
      <AdminSessionProvider session={session}>
        {/* Asked once per session rather than by each bilingual field. */}
        <TranslationProvider>
          <div className="min-h-screen bg-background">
            <AdminSidebar />
            <div className="transition-all duration-300 md:pl-16 lg:pl-64">
              {/* Rendered here, not per page: six of the nine pages used to
                  omit it, and the mobile navigation trigger lives inside — so
                  those pages had no way to open the menu on a phone. */}
              <AdminHeader />
              <main className="p-4 md:p-6">{children}</main>
            </div>
          </div>
        </TranslationProvider>
        <Toaster position="top-right" richColors closeButton />
      </AdminSessionProvider>
    </AdminLanguageProvider>
  )
}
