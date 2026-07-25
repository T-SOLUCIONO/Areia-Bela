import { ShieldCheck, Zap } from 'lucide-react'
import { RESPONSE_TIME_BADGE } from '@/lib/host-response'
import type { ResponseTimeKey } from '@/lib/property-data'

type Props = {
  isSuperhost: boolean
  responseTime: ResponseTimeKey
  responseRate?: string
  isEnglish: boolean
  className?: string
}

export function HostResponseBadges({
  isSuperhost,
  responseTime,
  responseRate,
  isEnglish,
  className,
}: Props) {
  const responseLabel = RESPONSE_TIME_BADGE[isEnglish ? 'en' : 'es'][responseTime]

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ''}`}>
      {isSuperhost && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200/70">
          <ShieldCheck className="h-3.5 w-3.5" />
          {isEnglish ? 'Superhost' : 'Superanfitriona'}
        </span>
      )}
      {responseLabel && (
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border">
          <Zap className="h-3.5 w-3.5" />
          {responseLabel}
        </span>
      )}
      {responseRate && (
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border">
          {responseRate} {isEnglish ? 'response rate' : 'de respuesta'}
        </span>
      )}
    </div>
  )
}
