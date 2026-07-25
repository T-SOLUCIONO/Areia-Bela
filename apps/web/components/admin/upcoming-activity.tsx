import { CalendarDays, Clock, Users } from 'lucide-react'

interface UpcomingActivityProps {
  checkIns: number
  checkOuts: number
  arrivals: { time: string; guest: string; room: string }[]
}

export function UpcomingActivity({ checkIns, checkOuts, arrivals }: UpcomingActivityProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-success/10 border border-success/20">
          <div className="flex items-center gap-2 text-success">
            <Users className="h-4 w-4" />
            <span className="text-sm font-medium">Check-ins</span>
          </div>
          <p className="text-2xl font-semibold text-success mt-2">{checkIns}</p>
        </div>
        <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
          <div className="flex items-center gap-2 text-warning">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">Check-outs</span>
          </div>
          <p className="text-2xl font-semibold text-warning mt-2">{checkOuts}</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Expected Arrivals</p>
        {arrivals.length > 0 ? (
          arrivals.map((arrival, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">{arrival.guest}</p>
                  <p className="text-xs text-muted-foreground">Room {arrival.room}</p>
                </div>
              </div>
              <span className="text-sm text-muted-foreground">{arrival.time}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">No arrivals scheduled</p>
        )}
      </div>
    </div>
  )
}
