import { redirect } from 'next/navigation'
import { ADMIN_LOGIN_PATH } from '@areia-bela/shared'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { AdminSessionProvider } from '@/components/admin/admin-session-provider'
import { getAdminSession } from '@/lib/admin-session'

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  // The real gate: the middleware only sees whether a cookie exists, so this
  // is where the session is actually verified against the API.
  const session = await getAdminSession()
  if (!session) redirect(ADMIN_LOGIN_PATH)

  return (
    <AdminSessionProvider session={session}>
      <div className="min-h-screen bg-background">
        <AdminSidebar />
        <div className="md:pl-16 lg:pl-64 transition-all duration-300">{children}</div>
      </div>
    </AdminSessionProvider>
  )
}
