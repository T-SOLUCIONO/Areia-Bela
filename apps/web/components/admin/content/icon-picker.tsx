'use client'

import { Check } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@areia-bela/ui/popover'
import { ScrollArea } from '@areia-bela/ui/scroll-area'
import { useAdminCopy } from '@/components/admin/admin-language-provider'
import {
  CONTENT_ICONS,
  ContentIcon,
  isContentIcon,
  type ContentIconName,
} from '@/lib/content-icons'
import { cn } from '@/lib/utils'

export function IconPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (icon: string) => void
}) {
  const t = useAdminCopy()
  const names = Object.keys(CONTENT_ICONS) as ContentIconName[]

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start gap-2">
          {isContentIcon(value) ? (
            <>
              <ContentIcon name={value} className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">{value}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{t.content.iconNone}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <ScrollArea className="h-64">
          <div className="grid grid-cols-6 gap-1 pr-2">
            {/* First cell clears the icon — a badge without one is valid. */}
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label={t.content.iconNone}
              className={cn(
                'flex aspect-square items-center justify-center rounded-md border text-xs text-muted-foreground transition-colors hover:bg-muted',
                value === '' && 'border-primary bg-primary/10 text-primary',
              )}
            >
              —
            </button>
            {names.map((name) => {
              const Icon = CONTENT_ICONS[name]
              const selected = value === name
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => onChange(name)}
                  title={name}
                  aria-label={name}
                  aria-pressed={selected}
                  className={cn(
                    'relative flex aspect-square items-center justify-center rounded-md border transition-colors hover:bg-muted',
                    selected ? 'border-primary bg-primary/10 text-primary' : 'text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {selected && (
                    <Check className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-primary text-primary-foreground" />
                  )}
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
