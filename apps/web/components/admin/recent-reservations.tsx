import { Badge } from '@areia-bela/ui/badge'
import type { Reservation } from '@/types'

interface RecentReservationsProps {
  reservations: Reservation[]
}

const statusColors = {
  pending: 'bg-warning/10 text-warning border-warning/20',
  confirmed: 'bg-primary/10 text-primary border-primary/20',
  'checked-in': 'bg-success/10 text-success border-success/20',
  'checked-out': 'bg-muted text-muted-foreground border-muted',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
}

export function RecentReservations({ reservations }: RecentReservationsProps) {
  return (
    <div className="space-y-4">
      {reservations.map((reservation) => (
        <div
          key={reservation.id}
          className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {reservation.guestName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </span>
            </div>
            <div>
              <p className="font-medium text-foreground">{reservation.guestName}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(reservation.checkIn).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                -{' '}
                {new Date(reservation.checkOut).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-medium text-foreground">
                ${reservation.totalPrice.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">
                Room {reservation.roomId.split('-').pop()}
              </p>
            </div>
            <Badge className={statusColors[reservation.status]}>{reservation.status}</Badge>
          </div>
        </div>
      ))}
    </div>
  )
}
