import { AdminHeader } from '@/components/admin/admin-header'

export default function ReservationsPage() {
  return (
    <div className="flex flex-col h-full">
      <AdminHeader
        title="Reservations"
        description="Manage all your incoming and current reservations."
      />
      <div className="flex-1 p-6">
        <div className="flex flex-col items-center justify-center h-[50vh] text-center border-2 border-dashed rounded-lg">
          <h2 className="text-xl font-medium text-muted-foreground mb-2">Reservations System</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            This module is currently under construction. Please check back later for reservation
            management capabilities.
          </p>
        </div>
      </div>
    </div>
  )
}
