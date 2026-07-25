import { AdminHeader } from '@/components/admin/admin-header'

export default function GuestsPage() {
  return (
    <div className="flex flex-col h-full">
      <AdminHeader title="Guest Directory" description="Manage guest profiles and preferences." />
      <div className="flex-1 p-6">
        <div className="flex flex-col items-center justify-center h-[50vh] text-center border-2 border-dashed rounded-lg">
          <h2 className="text-xl font-medium text-muted-foreground mb-2">Guest Directory</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            This module is currently under construction. Please check back later for guest
            management capabilities.
          </p>
        </div>
      </div>
    </div>
  )
}
