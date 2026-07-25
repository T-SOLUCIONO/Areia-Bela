import { AdminSidebar } from '@/components/admin/admin-sidebar'

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <div className="md:pl-16 lg:pl-64 transition-all duration-300">{children}</div>
    </div>
  )
}
