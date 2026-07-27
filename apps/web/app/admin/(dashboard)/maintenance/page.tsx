'use client'

import { useMemo, useState } from 'react'
import { addDays, format, isBefore, startOfDay } from 'date-fns'
import { enUS, es as esLocale } from 'date-fns/locale'
import { CircleDashed, CircleDot, CheckCircle2, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@areia-bela/ui/badge'
import { Button } from '@areia-bela/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@areia-bela/ui/card'
import { Input } from '@areia-bela/ui/input'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@areia-bela/ui/empty'
import { useAdminLanguage } from '@/components/admin/admin-language-provider'
import { DemoDataNotice } from '@/components/admin/demo-data-notice'
import type { AdminCopy } from '@/lib/admin-i18n'
import { cn } from '@/lib/utils'

type AreaKey = keyof AdminCopy['areas']
type Status = 'open' | 'inProgress' | 'done'
type Priority = 'high' | 'medium' | 'low'

interface Task {
  id: string
  area: AreaKey
  title: { en: string; es: string }
  status: Status
  priority: Priority
  assignee: string | null
  dueInDays: number
}

/**
 * Grouped by area of the house — pool, kitchen, bathrooms — rather than by room
 * number and floor, which is what this page used to do. There is one house
 * with three bedrooms and two bathrooms, not a floor plan of numbered units.
 *
 * The tasks themselves are still placeholders: there is no maintenance API yet.
 */
const DEMO_TASKS: Task[] = [
  {
    id: '1',
    area: 'pool',
    title: {
      en: 'Check heater before the season starts',
      es: 'Revisar el calentador antes de la temporada',
    },
    status: 'open',
    priority: 'high',
    assignee: null,
    dueInDays: 3,
  },
  {
    id: '2',
    area: 'bathrooms',
    title: { en: 'Slow drain in the guest bathroom', es: 'Desagüe lento en el baño de huéspedes' },
    status: 'inProgress',
    priority: 'medium',
    assignee: 'Carlos',
    dueInDays: 1,
  },
  {
    id: '3',
    area: 'kitchen',
    title: { en: 'Replace the coffee machine filter', es: 'Cambiar el filtro de la cafetera' },
    status: 'open',
    priority: 'low',
    assignee: 'Marta',
    dueInDays: 9,
  },
  {
    id: '4',
    area: 'outdoor',
    title: { en: 'Trim the hedge by the entrance', es: 'Podar el seto de la entrada' },
    status: 'done',
    priority: 'low',
    assignee: 'Carlos',
    dueInDays: -2,
  },
  {
    id: '5',
    area: 'mainBedroom',
    title: { en: 'Air conditioning makes a noise', es: 'El aire acondicionado hace ruido' },
    status: 'open',
    priority: 'high',
    assignee: null,
    dueInDays: 5,
  },
]

const STATUS_ORDER: Status[] = ['open', 'inProgress', 'done']

export default function MaintenancePage() {
  const { language, t } = useAdminLanguage()
  const locale = language === 'en' ? enUS : esLocale
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all')

  const statusMeta: Record<Status, { label: string; icon: typeof CircleDashed; tone: string }> = {
    open: { label: t.maintenance.open, icon: CircleDashed, tone: 'text-amber-600' },
    inProgress: { label: t.maintenance.inProgress, icon: CircleDot, tone: 'text-primary' },
    done: { label: t.maintenance.done, icon: CheckCircle2, tone: 'text-emerald-600' },
  }

  const priorityMeta: Record<Priority, { label: string; className: string }> = {
    high: {
      label: t.maintenance.priorityHigh,
      className: 'border-destructive/40 text-destructive',
    },
    medium: { label: t.maintenance.priorityMedium, className: 'border-amber-400 text-amber-700' },
    low: { label: t.maintenance.priorityLow, className: 'border-border text-muted-foreground' },
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return DEMO_TASKS.filter((task) => {
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter
      const matchesQuery =
        !needle ||
        task.title[language].toLowerCase().includes(needle) ||
        t.areas[task.area].toLowerCase().includes(needle)
      return matchesStatus && matchesQuery
    })
  }, [query, statusFilter, language, t.areas])

  const counts = STATUS_ORDER.map((status) => ({
    status,
    count: DEMO_TASKS.filter((task) => task.status === status).length,
  }))

  const today = startOfDay(new Date())

  return (
    <div className="space-y-6">
      <DemoDataNotice />

      <div className="grid gap-4 sm:grid-cols-3">
        {counts.map(({ status, count }) => {
          const meta = statusMeta[status]
          const active = statusFilter === status
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(active ? 'all' : status)}
              aria-pressed={active}
              className={cn(
                'rounded-xl border p-4 text-left transition-colors',
                active ? 'border-primary bg-secondary' : 'border-border hover:bg-secondary/50',
              )}
            >
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <meta.icon className={cn('h-4 w-4', meta.tone)} />
                {meta.label}
              </span>
              <span className="mt-1 block font-serif text-3xl tabular-nums text-foreground">
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="font-serif text-lg">{t.maintenance.areaTitle}</CardTitle>
            <CardDescription>{t.navDescription.maintenance}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.header.search}
                className="w-full pl-9 sm:w-56"
                aria-label={t.header.search}
              />
            </div>
            <Button variant="brand" size="sm" onClick={() => toast.info(t.calendar.comingSoon)}>
              <Plus className="h-4 w-4" />
              {t.maintenance.addTask}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {visible.length === 0 ? (
            <Empty className="min-h-[240px]">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CheckCircle2 />
                </EmptyMedia>
                <EmptyTitle>{t.maintenance.noTasks}</EmptyTitle>
                <EmptyDescription>{t.navDescription.maintenance}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((task) => {
                const meta = statusMeta[task.status]
                const due = addDays(today, task.dueInDays)
                const overdue = task.status !== 'done' && isBefore(due, today)

                return (
                  <li key={task.id} className="flex flex-wrap items-center gap-4 py-4">
                    <meta.icon className={cn('h-5 w-5 shrink-0', meta.tone)} />

                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'font-medium text-foreground',
                          task.status === 'done' && 'text-muted-foreground line-through',
                        )}
                      >
                        {task.title[language]}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t.areas[task.area]} ·{' '}
                        {task.assignee ?? (
                          <span className="italic">{t.maintenance.unassigned}</span>
                        )}
                      </p>
                    </div>

                    <Badge variant="outline" className={priorityMeta[task.priority].className}>
                      {priorityMeta[task.priority].label}
                    </Badge>

                    <span
                      className={cn(
                        'shrink-0 text-sm tabular-nums',
                        overdue ? 'font-medium text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {t.maintenance.due} {format(due, 'd MMM', { locale })}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
